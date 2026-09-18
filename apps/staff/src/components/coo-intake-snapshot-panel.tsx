"use client";

import { formatPortalDateTime, PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Snapshot = {
  generatedAt: string;
  queue: {
    newReferral: number;
    pendingAuthorization: number;
    totalPipeline: number;
    oldestReferredAt: string | null;
    medianDaysInQueue: number | null;
  };
  sla: {
    stuckOver7Days: number;
    stuckSample: Array<{
      id: string;
      fullName: string | null;
      intakeStatus: string;
      referredAt: string | null;
      intakeStatusChangedAt: string | null;
      daysSinceReferred: number | null;
      daysSinceStatusChange: number | null;
    }>;
  };
  funnel: {
    activationsLast7Days: number;
    referralsCreatedLast7Days: number;
    scheduledIntakesWithoutBillingReady: number;
  };
  errors: {
    last24Hours: number;
    last7Days: number;
  };
};

export function CooIntakeSnapshotPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/coo-snapshot");
      const data = (await res.json()) as { snapshot?: Snapshot; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load snapshot");
      setSnapshot(data.snapshot ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load snapshot");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-brand-black/60">Loading intake snapshot…</p>;
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {error}
      </p>
    );
  }

  if (!snapshot) {
    return <p className="text-sm text-brand-black/60">No snapshot data.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-brand-black/55">
          Updated {formatPortalDateTime(snapshot.generatedAt, PORTAL_DISPLAY_TIME_ZONE)} (Eastern)
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-brand-green hover:bg-neutral-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Referral queue" value={String(snapshot.queue.totalPipeline)} hint="New + pending auth" />
        <StatCard
          label="Oldest in queue"
          value={
            snapshot.queue.oldestReferredAt
              ? `${snapshot.queue.medianDaysInQueue ?? "—"}d median`
              : "—"
          }
          hint={
            snapshot.queue.oldestReferredAt
              ? formatPortalDateTime(snapshot.queue.oldestReferredAt, PORTAL_DISPLAY_TIME_ZONE)
              : "No pending referrals"
          }
        />
        <StatCard label="SLA stuck (7d+)" value={String(snapshot.sla.stuckOver7Days)} hint="Status clock + GA TSE Phase 1" />
        <StatCard label="System errors (24h)" value={String(snapshot.errors.last24Hours)} hint={`${snapshot.errors.last7Days} in 7 days`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-brand-black">Referral pipeline</h3>
          <ul className="mt-3 space-y-1 text-sm text-brand-black/80">
            <li>New referral: {snapshot.queue.newReferral}</li>
            <li>Pending authorization: {snapshot.queue.pendingAuthorization}</li>
          </ul>
          <Link href="/dashboard/referrals" className="mt-3 inline-block text-sm font-medium text-brand-green hover:underline">
            Open Referral Queue →
          </Link>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-brand-black">Last 7 days</h3>
          <ul className="mt-3 space-y-1 text-sm text-brand-black/80">
            <li>Referrals created: {snapshot.funnel.referralsCreatedLast7Days}</li>
            <li>Activations: {snapshot.funnel.activationsLast7Days}</li>
            <li>Intake scheduled (not ready to bill): {snapshot.funnel.scheduledIntakesWithoutBillingReady}</li>
          </ul>
          <Link
            href="/dashboard/intake-billing"
            className="mt-3 inline-block text-sm font-medium text-brand-green hover:underline"
          >
            Intake Billing →
          </Link>
        </section>
      </div>

      {snapshot.sla.stuckSample.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <h3 className="text-sm font-semibold text-brand-black">Needs follow-up (sample)</h3>
          <p className="mt-1 text-xs text-brand-black/60">
            Days since referred and since last intake status change are both shown for internal SLA review.
          </p>
          <ul className="mt-3 divide-y divide-amber-200/80 text-sm">
            {snapshot.sla.stuckSample.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <Link href={`/dashboard/referrals/${row.id}`} className="font-medium text-brand-green hover:underline">
                    {row.fullName || row.id}
                  </Link>
                  <p className="text-xs text-brand-black/60">
                    {row.intakeStatus}
                    {row.daysSinceReferred != null ? ` · ${row.daysSinceReferred}d since referred` : ""}
                    {row.daysSinceStatusChange != null
                      ? ` · ${row.daysSinceStatusChange}d since status change`
                      : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-black/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-brand-black">{value}</p>
      <p className="mt-1 text-xs text-brand-black/55">{hint}</p>
    </div>
  );
}
