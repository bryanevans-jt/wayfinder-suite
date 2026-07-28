"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type WeekPack = {
  messageSla: number;
  thinContacts: number;
  reportGaps: number;
  timesheetsPending: number;
};

function StatLink({
  href,
  count,
  label,
  tone,
}: {
  href: string;
  count: number;
  label: string;
  tone?: "urgent" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "urgent"
      ? "border-red-200 bg-red-50"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50"
        : "border-neutral-200 bg-white";
  return (
    <Link
      href={href}
      className={`rounded-xl border px-3 py-3 transition hover:border-brand-green/40 ${toneClass}`}
    >
      <p className="text-2xl font-semibold tabular-nums text-brand-black">{count}</p>
      <p className="mt-1 text-xs font-medium text-brand-black/70">{label}</p>
    </Link>
  );
}

export function SupervisorWeekPack() {
  const [pack, setPack] = useState<WeekPack | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/supervisor/week-pack", { cache: "no-store" });
      const data = (await res.json()) as WeekPack & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load this week.");
      setPack({
        messageSla: data.messageSla ?? 0,
        thinContacts: data.thinContacts ?? 0,
        reportGaps: data.reportGaps ?? 0,
        timesheetsPending: data.timesheetsPending ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this week.");
      setPack(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
        <p className="text-sm text-red-800">{error}</p>
      </section>
    );
  }

  if (!pack) {
    return (
      <section className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3">
        <p className="text-sm text-brand-black/60">Loading this week…</p>
      </section>
    );
  }

  const total =
    pack.messageSla + pack.thinContacts + pack.reportGaps + pack.timesheetsPending;

  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-brand-black">This week</h2>
          <p className="mt-1 text-sm text-brand-black/65">
            {total === 0
              ? "No coaching or compliance items need you right now."
              : "Open items across messages, contacts, reports, and timesheets."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs font-semibold text-brand-green hover:underline"
        >
          Refresh
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatLink
          href="/dashboard/operations"
          count={pack.messageSla}
          label="Message SLA overdue"
          tone={pack.messageSla > 0 ? "urgent" : "neutral"}
        />
        <StatLink
          href="/dashboard/operations"
          count={pack.thinContacts}
          label="Thin contact logs"
          tone={pack.thinContacts > 0 ? "warn" : "neutral"}
        />
        <StatLink
          href="/dashboard/compliance"
          count={pack.reportGaps}
          label="Report gaps"
          tone={pack.reportGaps > 0 ? "warn" : "neutral"}
        />
        <StatLink
          href="/dashboard/timesheet"
          count={pack.timesheetsPending}
          label="Timesheets to review"
          tone={pack.timesheetsPending > 0 ? "warn" : "neutral"}
        />
      </div>
    </section>
  );
}
