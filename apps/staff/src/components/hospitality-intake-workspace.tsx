"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Task = {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  appointment_starts_at?: string | null;
  appointment_location?: string | null;
  client: {
    id: string;
    full_name: string | null;
    contact_email: string | null;
    primary_phone: string | null;
  } | null;
};

export function HospitalityIntakeWorkspace() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"open" | "completed" | "all">("open");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<
    Record<string, { date: string; time: string; location: string }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hospitality/intakes?status=${filter}`);
      const data = (await res.json()) as { tasks?: Task[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setTasks(data.tasks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function complete(id: string) {
    const slot = schedule[id];
    setError(null);
    setNotice(null);
    if (!slot?.date || !slot?.time) {
      setError("Enter the intake date and time before marking complete.");
      return;
    }
    if (!slot.location.trim()) {
      setError("Enter the intake location before marking complete.");
      return;
    }
    const scheduledAt = new Date(`${slot.date}T${slot.time}:00`).toISOString();
    const res = await fetch("/api/hospitality/intakes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: id,
        action: "complete",
        scheduledAt,
        location: slot.location.trim(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      reminder?: { sent?: number; skipped?: number; errors?: string[] };
    };
    if (!res.ok) {
      setError(data.error || "Could not complete");
      return;
    }
    if (data.reminder?.sent) {
      setNotice("Intake scheduled. Confirmation email sent to the client.");
    } else if (data.reminder?.errors?.length) {
      setNotice(
        `Intake scheduled, but the confirmation email did not send: ${data.reminder.errors[0]}`
      );
    } else {
      setNotice(
        "Intake scheduled. No confirmation email sent (client may not have an email on file)."
      );
    }
    await load();
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2 text-sm">
        {(["open", "completed", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 font-medium ${
              filter === f
                ? "bg-brand-green text-white"
                : "border border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            {f === "open" ? "Incomplete" : f === "completed" ? "Complete" : "All"}
          </button>
        ))}
      </div>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          {notice}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-brand-black/60">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-brand-black/60">No intake tasks.</p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3"
            >
              <div>
                <Link
                  href={`/dashboard/hospitality/intakes/${t.client?.id}`}
                  className="font-semibold text-brand-green hover:underline"
                >
                  {t.client?.full_name || t.client?.contact_email || t.client?.id}
                </Link>
                <p className="text-sm text-brand-black/65">
                  {t.client?.primary_phone || "No phone"}
                  {t.client?.contact_email ? ` · ${t.client.contact_email}` : " · No email"} · Opened{" "}
                  {new Date(t.created_at).toLocaleString()}
                  {t.status === "completed" && t.completed_at
                    ? ` · Done ${new Date(t.completed_at).toLocaleString()}`
                    : ""}
                </p>
                {t.status === "completed" && t.appointment_starts_at ? (
                  <p className="mt-1 text-xs text-brand-black/55">
                    Appointment {new Date(t.appointment_starts_at).toLocaleString()}
                    {t.appointment_location ? ` · ${t.appointment_location}` : ""}
                  </p>
                ) : null}
              </div>
              {t.status === "open" ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs font-medium text-brand-black/70">
                    Intake date
                    <input
                      type="date"
                      value={schedule[t.id]?.date ?? ""}
                      onChange={(e) =>
                        setSchedule((prev) => ({
                          ...prev,
                          [t.id]: {
                            date: e.target.value,
                            time: prev[t.id]?.time ?? "",
                            location: prev[t.id]?.location ?? "",
                          },
                        }))
                      }
                      className="mt-1 block rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs font-medium text-brand-black/70">
                    Time
                    <input
                      type="time"
                      value={schedule[t.id]?.time ?? ""}
                      onChange={(e) =>
                        setSchedule((prev) => ({
                          ...prev,
                          [t.id]: {
                            date: prev[t.id]?.date ?? "",
                            time: e.target.value,
                            location: prev[t.id]?.location ?? "",
                          },
                        }))
                      }
                      className="mt-1 block rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs font-medium text-brand-black/70">
                    Location
                    <input
                      type="text"
                      placeholder="Office, library, Zoom…"
                      value={schedule[t.id]?.location ?? ""}
                      onChange={(e) =>
                        setSchedule((prev) => ({
                          ...prev,
                          [t.id]: {
                            date: prev[t.id]?.date ?? "",
                            time: prev[t.id]?.time ?? "",
                            location: e.target.value,
                          },
                        }))
                      }
                      className="mt-1 block min-w-[12rem] rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void complete(t.id)}
                    className="rounded-lg bg-brand-gold px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-gold/90"
                  >
                    Mark complete
                  </button>
                </div>
              ) : (
                <span className="text-xs font-medium uppercase tracking-wide text-brand-black/45">
                  Complete
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
