"use client";

import type { IjpAttestationSlaRow } from "@/lib/ijp-operations-alerts";
import { DismissIjpAttestationSlaButton } from "@/components/dismiss-ijp-attestation-sla-button";
import { formatPortalDateTime } from "@wayfinder/branding";
import Link from "next/link";
import { useState } from "react";

type Props = {
  initialRows: IjpAttestationSlaRow[];
};

export function IjpAttestationSlaPanel({ initialRows }: Props) {
  const [rows, setRows] = useState(initialRows);

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-brand-black">IJP client attestation SLA</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Open attestation alerts for GA IJP clients (after the 25th when billable time exists).
        </p>
        <p className="mt-4 text-sm text-brand-black/60">No open IJP attestation SLA alerts in your scope.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
      <h2 className="text-base font-semibold text-brand-black">IJP client attestation SLA</h2>
      <p className="mt-1 text-sm text-brand-black/65">
        Missing monthly client signatures for IJP billing. Dismiss hides this SLA alert only — caseload
        still shows Signature needed until capture.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {rows.map((row) => (
          <li
            key={row.alertId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2"
          >
            <div>
              <span className="font-medium">{row.clientName}</span> · {row.esName} · {row.reportingMonth}
              {row.dueAt ? (
                <span className="text-brand-black/65"> · due {formatPortalDateTime(row.dueAt)}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/dashboard/clients/${encodeURIComponent(row.clientId)}`}
                className="text-brand-green hover:underline"
              >
                Client profile →
              </Link>
              <DismissIjpAttestationSlaButton
                clientId={row.clientId}
                serviceMonth={row.reportingMonth}
                onDismissed={() => setRows((prev) => prev.filter((r) => r.alertId !== row.alertId))}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
