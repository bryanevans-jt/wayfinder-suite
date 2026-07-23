"use client";

import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import {
  minutesToClockLabel,
  shiftDurationMinutes,
  type StaffClockShiftRow,
} from "@wayfinder/supabase/staff-time-clock-shared";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

type StatusPayload = {
  staffUserId: string;
  today: string;
  open: StaffClockShiftRow | null;
  todayMinutes: number;
  todayShifts: StaffClockShiftRow[];
  attentionShifts: StaffClockShiftRow[];
  recentShifts: StaffClockShiftRow[];
  stillWorkingPromptPending?: boolean;
};

type TeamPayload = {
  clockedIn: Array<{
    staffUserId: string;
    name: string;
    shiftId: string;
    clockInAt: string;
    minutesSoFar: number;
    stillWorkingPromptPending: boolean;
  }>;
  attention: Array<{
    shiftId: string;
    staffUserId: string;
    name: string;
    localDate: string;
    clockInAt: string;
    clockOutAt: string | null;
    autoOutReason: string | null;
  }>;
};

type Props = {
  canViewTeam: boolean;
  canEditOthers: boolean;
};

function formatNy(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Interpret datetime-local as America/New_York wall time → ISO. */
function fromDatetimeLocalNy(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error("Invalid date/time");
  }
  const [, ys, ms, ds, hs, mins] = match;
  const y = Number(ys);
  const m = Number(ms);
  const day = Number(ds);
  const h = Number(hs);
  const minute = Number(mins);
  let guess = new Date(Date.UTC(y, m - 1, day, h, minute, 0));
  for (let i = 0; i < 3; i++) {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const map: Record<string, string> = {};
    for (const part of dtf.formatToParts(guess)) {
      if (part.type !== "literal") map[part.type] = part.value;
    }
    const asUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second)
    );
    const wanted = Date.UTC(y, m - 1, day, h, minute, 0);
    guess = new Date(guess.getTime() + (wanted - asUtc));
  }
  return guess.toISOString();
}

export function StaffTimeClockWorkspace({ canViewTeam, canEditOthers }: Props) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [team, setTeam] = useState<TeamPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffClockShiftRow | null>(null);
  const [editIn, setEditIn] = useState("");
  const [editOut, setEditOut] = useState("");
  const [editReason, setEditReason] = useState("");
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const res = await fetch("/api/staff-clock");
    const data = (await res.json()) as StatusPayload & { error?: string };
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setStatus(data);
    setError(null);
  }, []);

  const loadTeam = useCallback(async () => {
    if (!canViewTeam) return;
    const res = await fetch("/api/staff-clock/team");
    const data = (await res.json()) as TeamPayload & { error?: string };
    if (!res.ok) {
      return;
    }
    setTeam(data);
  }, [canViewTeam]);

  useEffect(() => {
    void load();
    void loadTeam();
  }, [load, loadTeam]);

  const dayGroups = useMemo(() => {
    const shifts = status?.recentShifts ?? [];
    const map = new Map<string, StaffClockShiftRow[]>();
    for (const s of shifts) {
      const list = map.get(s.local_date) ?? [];
      list.push(s);
      map.set(s.local_date, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [status?.recentShifts]);

  function beginEdit(shift: StaffClockShiftRow) {
    setEditing(shift);
    setEditIn(toDatetimeLocalValue(shift.clock_in_at));
    setEditOut(shift.clock_out_at ? toDatetimeLocalValue(shift.clock_out_at) : "");
    setEditReason("");
    setError(null);
  }

  function postAction(path: string) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(path, { method: "POST" });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
        }
        await load();
        await loadTeam();
      } catch (e) {
        setError(friendlyClientError(e));
      }
    });
  }

  function saveEdit() {
    if (!editing) return;
    setError(null);
    startTransition(async () => {
      try {
        const body: Record<string, unknown> = {
          clockInAt: fromDatetimeLocalNy(editIn),
          clockOutAt: editOut.trim() ? fromDatetimeLocalNy(editOut) : null,
          reason: editReason.trim() || null,
        };
        if (editing.needs_attention) {
          body.needsAttention = false;
        }
        const res = await fetch(`/api/staff-clock/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
        }
        setEditing(null);
        await load();
        await loadTeam();
      } catch (e) {
        setError(friendlyClientError(e));
      }
    });
  }

  return (
    <div className="mt-6 max-w-4xl space-y-8">
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-brand-black">
              Current Status <span className="font-normal text-brand-black/55">(Eastern)</span>
            </h2>
            <p className="mt-1 text-sm text-brand-black/65">
              {status
                ? status.open
                  ? `Clocked in · today ${minutesToClockLabel(status.todayMinutes)}`
                  : `Clocked out · today ${minutesToClockLabel(status.todayMinutes)}`
                : "Loading…"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {status?.stillWorkingPromptPending ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => postAction("/api/staff-clock/still-working")}
                className="rounded-lg border border-amber-600 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
              >
                Still Working
              </button>
            ) : null}
            {status?.open ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => postAction("/api/staff-clock/out")}
                className="rounded-lg border border-brand-black/20 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-neutral-100 disabled:opacity-60"
              >
                Clock Out
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => postAction("/api/staff-clock/in")}
                className="rounded-lg border border-brand-green bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
              >
                Clock In
              </button>
            )}
          </div>
        </div>
      </section>

      {status?.stillWorkingPromptPending ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Still working after 5:30 PM?</p>
          <p className="mt-1">
            Confirm with Still Working above. If you do not respond by 6:00 PM Eastern, the system
            clocks you out at 5:30 PM and flags the entry for review.
          </p>
        </div>
      ) : null}

      {(status?.attentionShifts?.length ?? 0) > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
          <h2 className="text-base font-semibold text-brand-black">Needs Your Attention</h2>
          <p className="mt-1 text-sm text-brand-black/70">
            These entries were auto clocked out or flagged. Edit the times if they are wrong, then
            save — that clears the flag.
          </p>
          <ul className="mt-4 space-y-2">
            {status!.attentionShifts.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm"
              >
                <span>
                  {s.local_date} · {formatNy(s.clock_in_at)} → {formatNy(s.clock_out_at)}
                  {s.auto_out_reason === "still_working_timeout" ? (
                    <span className="ml-2 text-xs text-amber-800">auto-out 5:30 PM</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => beginEdit(s)}
                  className="text-xs font-semibold text-brand-green hover:underline"
                >
                  Edit Entry
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canViewTeam && team ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-semibold text-brand-black">Who&apos;s Clocked In</h2>
          <p className="mt-1 text-sm text-brand-black/65">
            Live open shifts for your team (Eastern time).
          </p>
          {team.clockedIn.length === 0 ? (
            <p className="mt-4 text-sm text-brand-black/55">Nobody is clocked in right now.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {team.clockedIn.map((row) => (
                <li
                  key={row.shiftId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
                >
                  <span className="font-medium text-brand-black">{row.name}</span>
                  <span className="text-brand-black/65">
                    since {formatNy(row.clockInAt)} · {minutesToClockLabel(row.minutesSoFar)}
                    {row.stillWorkingPromptPending ? (
                      <span className="ml-2 text-amber-800">awaiting still-working reply</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {team.attention.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-brand-black">Flagged Team Entries</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {team.attention.map((row) => (
                  <li
                    key={row.shiftId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2"
                  >
                    <span>
                      <span className="font-medium">{row.name}</span> · {row.localDate} ·{" "}
                      {formatNy(row.clockInAt)} → {formatNy(row.clockOutAt)}
                    </span>
                    {canEditOthers ? (
                      <button
                        type="button"
                        onClick={() =>
                          beginEdit({
                            id: row.shiftId,
                            staff_user_id: row.staffUserId,
                            clock_in_at: row.clockInAt,
                            clock_out_at: row.clockOutAt,
                            local_date: row.localDate,
                            auto_out_reason:
                              (row.autoOutReason as StaffClockShiftRow["auto_out_reason"]) ?? null,
                            needs_attention: true,
                            attention_cleared_at: null,
                            still_working_prompted_at: null,
                            still_working_ack_at: null,
                            notes: null,
                            created_at: "",
                            updated_at: "",
                          })
                        }
                        className="text-xs font-semibold text-brand-green hover:underline"
                      >
                        Edit
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-brand-black">Your Recent Days</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Multiple clock-ins per day are fine. Totals below are for accountability (Eastern).
        </p>
        {dayGroups.length === 0 ? (
          <p className="mt-4 text-sm text-brand-black/55">No clock entries yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {dayGroups.map(([date, shifts]) => {
              const total = shifts.reduce(
                (sum, s) => sum + shiftDurationMinutes(s.clock_in_at, s.clock_out_at),
                0
              );
              return (
                <div key={date} className="rounded-lg border border-neutral-100 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-brand-black">{date}</h3>
                    <span className="text-sm text-brand-black/70">
                      {minutesToClockLabel(total)}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {shifts.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-brand-black/80"
                      >
                        <span>
                          {formatNy(s.clock_in_at)} → {formatNy(s.clock_out_at)}
                          {s.needs_attention ? (
                            <span className="ml-2 text-xs text-amber-800">needs review</span>
                          ) : null}
                          {s.auto_out_reason === "midnight_split" ? (
                            <span className="ml-2 text-xs text-brand-black/45">midnight split</span>
                          ) : null}
                        </span>
                        <button
                          type="button"
                          onClick={() => beginEdit(s)}
                          className="text-xs font-medium text-brand-green hover:underline"
                        >
                          Edit
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-brand-black">Edit Time Clock Entry</h2>
            <p className="mt-1 text-xs text-brand-black/60">
              Times are America/New_York. Every edit is logged for transparency.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium">
                Clock in
                <input
                  type="datetime-local"
                  value={editIn}
                  onChange={(e) => setEditIn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  disabled={pending}
                />
              </label>
              <label className="block text-sm font-medium">
                Clock out (leave blank if still open)
                <input
                  type="datetime-local"
                  value={editOut}
                  onChange={(e) => setEditOut(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  disabled={pending}
                />
              </label>
              <label className="block text-sm font-medium">
                Reason for edit
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="Optional note"
                  disabled={pending}
                />
              </label>
            </div>
            {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={pending}
                className="rounded-lg px-3 py-2 text-sm text-brand-black/70 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={pending || !editIn}
                className="rounded-lg border border-brand-green bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error && !editing ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
