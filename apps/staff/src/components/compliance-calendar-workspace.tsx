"use client";

import type { ComplianceReportRow } from "@/lib/operations-data";
import { DismissIjpAttestationSlaButton } from "@/components/dismiss-ijp-attestation-sla-button";
import { formatPortalDateTime } from "@wayfinder/branding";
import Link from "next/link";
import { useState } from "react";

type Props = {
  reports: ComplianceReportRow[];
  orgWide: boolean;
};

export function ComplianceCalendarWorkspace({ reports, orgWide }: Props) {
  const [rows, setRows] = useState(reports);
  const missing = rows.filter((r) => r.alertType === "missing").length;
  const overdue = rows.filter((r) => r.alertType === "overdue").length;

  return (
    <div className="mt-8 max-w-5xl space-y-6">
      {rows.length > 0 ? (
        <p className="text-sm text-brand-black/70">
          {orgWide ? "Organization-wide · " : null}
          {missing > 0 ? `${missing} missing` : null}
          {missing > 0 && overdue > 0 ? " · " : null}
          {overdue > 0 ? `${overdue} overdue` : null}
          {missing === 0 && overdue === 0 ? `${rows.length} open alert${rows.length === 1 ? "" : "s"}` : null}
        </p>
      ) : null}

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-brand-black">Report alerts</h2>
        <p className="mt-1 text-sm text-brand-black/60">
          Open missing and overdue official GVRA reports{orgWide ? " across the organization" : " in your scope"}.
        </p>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-brand-black/65">No open report alerts in your scope.</p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium text-brand-black">
                    {r.clientName} · {r.alertType === "overdue" ? "Overdue" : "Missing"} · {r.reportLabel}
                  </p>
                  <p className="text-brand-black/60">
                    {r.esName} · {r.reportingMonth}
                    {r.dueAt ? ` · due ${formatPortalDateTime(r.dueAt)}` : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/dashboard/clients/${encodeURIComponent(r.clientId)}`}
                    className="text-brand-green hover:underline"
                  >
                    Client profile →
                  </Link>
                  {r.reportTypeSlug === "ijp_attestation" ? (
                    <DismissIjpAttestationSlaButton
                      clientId={r.clientId}
                      serviceMonth={r.reportingMonth}
                      onDismissed={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                    />
                  ) : (
                    <Link href="/dashboard/reporting" className="text-brand-green hover:underline">
                      Submit Reports →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
