"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Task = {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
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
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<Record<string, { date: string; time: string }>>({});

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
    const scheduledAt =
      slot?.date && slot?.time ? new Date(`${slot.date}T${slot.time}:00`).toISOString() : null;
    const res = await fetch("/api/hospitality/intakes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: id, action: "complete", scheduledAt }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error || "Could not complete");
      return;
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
                  {t.client?.primary_phone || "No phone"} · Opened{" "}
                  {new Date(t.created_at).toLocaleString()}
                  {t.status === "completed" && t.completed_at
                    ? ` · Done ${new Date(t.completed_at).toLocaleString()}`
                    : ""}
                </p>
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
                          [t.id]: { date: e.target.value, time: prev[t.id]?.time ?? "" },
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
                          [t.id]: { date: prev[t.id]?.date ?? "", time: e.target.value },
                        }))
                      }
                      className="mt-1 block rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
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
