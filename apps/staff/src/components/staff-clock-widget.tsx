"use client";

import { friendlyClientError, parseApiErrorResponse, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import {
  minutesToClockLabel,
  type StaffClockShiftRow,
} from "@wayfinder/supabase/staff-time-clock-shared";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

type StatusPayload = {
  today: string;
  open: StaffClockShiftRow | null;
  todayMinutes: number;
  stillWorkingPromptPending?: boolean;
  attentionShifts?: StaffClockShiftRow[];
  error?: string;
};

type Props = {
  /** Compact strip for dashboard shell. */
  compact?: boolean;
};

export function StaffClockWidget({ compact = true }: Props) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const res = await fetch("/api/staff-clock");
    const data = (await res.json()) as StatusPayload & { error?: string };
    if (!res.ok) {
      // Hide widget quietly when role/table is unavailable
      if (res.status === 403 || res.status === 404) {
        setStatus(null);
        return;
      }
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setError(null);
    setStatus(data);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  function run(action: "in" | "out" | "still-working") {
    setError(null);
    startTransition(async () => {
      try {
        const path =
          action === "in"
            ? "/api/staff-clock/in"
            : action === "out"
              ? "/api/staff-clock/clock-out"
              : "/api/staff-clock/still-working";
        const res = await fetch(path, { method: "POST" });
        if (!res.ok) {
          const { message } = await parseApiErrorResponse(res);
          throw new Error(message);
        }
        await load();
      } catch (e) {
        setError(friendlyClientError(e));
      }
    });
  }

  if (!status) {
    return error && !compact ? <p className="text-sm text-red-700">{error}</p> : null;
  }

  const clockedIn = Boolean(status.open);
  const attentionCount = status.attentionShifts?.length ?? 0;

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
          : "rounded-xl border border-neutral-200 bg-white p-4"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-black">
            Time Clock{" "}
            <span className="font-normal text-brand-black/55">(Eastern)</span>
          </p>
          <p className="mt-0.5 text-xs text-brand-black/65">
            {clockedIn ? (
              <>
                Clocked in · today {minutesToClockLabel(status.todayMinutes)}
              </>
            ) : (
              <>Clocked out · today {minutesToClockLabel(status.todayMinutes)}</>
            )}
            {attentionCount > 0 ? (
              <span className="ml-2 text-amber-800">
                · {attentionCount} need{attentionCount === 1 ? "s" : ""} review
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status.stillWorkingPromptPending ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run("still-working")}
              className="rounded-lg border border-amber-600 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
            >
              Still Working
            </button>
          ) : null}
          {clockedIn ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run("out")}
              className="rounded-lg border border-brand-black/20 bg-white px-3 py-1.5 text-xs font-semibold text-brand-black hover:bg-neutral-100 disabled:opacity-60"
            >
              Clock Out
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run("in")}
              className="rounded-lg border border-brand-green bg-brand-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
            >
              Clock In
            </button>
          )}
          <Link
            href="/dashboard/time-clock"
            className="text-xs font-medium text-brand-green hover:underline"
          >
            Details
          </Link>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
