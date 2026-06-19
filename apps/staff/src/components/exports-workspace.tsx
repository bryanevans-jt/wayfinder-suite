"use client";

import { canAccessFormalReporting } from "@/lib/staff-nav";
import { isEsRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { ReportingVsExportsGuide } from "./reporting-vs-exports-guide";

type Props = {
  role: string | null;
  readOnly?: boolean;
};

type ExportCard = {
  title: string;
  description: string;
  href: string;
  filename: string;
  roles: Array<"es" | "supervisor">;
};

const EXPORT_CARDS: ExportCard[] = [
  {
    title: "My caseload",
    description:
      "Current service, stage, office, and counselor for every client assigned to you.",
    href: "/api/exports/caseload",
    filename: "wayfinder-caseload.csv",
    roles: ["es"],
  },
  {
    title: "Applications by client",
    description:
      "Every job application in your scope — one row per application with client name, employer, status, and notes.",
    href: "/api/exports/applications",
    filename: "wayfinder-applications-by-client.csv",
    roles: ["es", "supervisor"],
  },
  {
    title: "My client activity",
    description:
      "Contact logs, job applications, and stage changes for your assigned clients (most recent first). For monthly narrative text, use the report panel on each client profile.",
    href: "/api/exports/activity",
    filename: "wayfinder-client-activity.csv",
    roles: ["es"],
  },
  {
    title: "My timesheet",
    description:
      "Review billable hours by pay week, submit for supervisor approval, and download CSV from the Timesheet page.",
    href: "/dashboard/timesheet",
    filename: "wayfinder-timesheet.csv",
    roles: ["es"],
  },
];

function canUseExport(role: string | null, card: ExportCard): boolean {
  if (isEsRole(role)) {
    return card.roles.includes("es");
  }
  if (isSupervisorRole(role)) {
    return card.roles.includes("supervisor");
  }
  return false;
}

function hasAnyExport(role: string | null): boolean {
  return EXPORT_CARDS.some((card) => canUseExport(role, card));
}

export function ExportsWorkspace({ role, readOnly = false }: Props) {
  const visibleExports = EXPORT_CARDS.filter((card) => canUseExport(role, card));
  const canDownload = hasAnyExport(role);
  const showReportingLink = canAccessFormalReporting(role);

  return (
    <div className="mt-8 max-w-3xl space-y-8">
      {readOnly ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Read-only preview — CSV downloads still reflect this user&apos;s scope.
        </p>
      ) : null}

      <ReportingVsExportsGuide context="exports" showReportingLink={showReportingLink} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">CSV downloads</h2>
        <p className="text-sm text-brand-black/70">
          Pull operational data into a spreadsheet. These files are for analysis and internal use —
          not for funder PDF submission.
        </p>
        {!canDownload ? (
          <p className="text-sm text-brand-black/70">
            CSV downloads are available to <strong>employment specialists</strong> and{" "}
            <strong>supervisors</strong> (applications). Administrators can export org-wide activity
            from the <strong>Activity logs</strong> tab in the admin or supervisor portal, and review
            messages under <strong>Message audit</strong> (admin tier). For org metrics, use{" "}
            <a href="/dashboard/analytics" className="font-medium text-brand-green hover:underline">
              Analytics
            </a>
            .
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleExports.map((item) => (
            <article
              key={item.href}
              className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4"
            >
              <h3 className="font-semibold text-brand-black">{item.title}</h3>
              <p className="mt-2 flex-1 text-sm text-brand-black/70">{item.description}</p>
              <a
                href={item.href.startsWith("/dashboard") ? item.href : item.href}
                className="mt-4 inline-flex w-fit rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white"
              >
                {item.href.startsWith("/dashboard") ? "Open" : "Download CSV"}
              </a>
              <p className="mt-2 text-xs text-brand-black/45">{item.filename}</p>
            </article>
          ))}
        </div>
        {isSupervisorRole(role) ? (
          <p className="text-xs text-brand-black/60">
            As a supervisor, applications include every client assigned to ES staff in your scope.
          </p>
        ) : null}
      </section>

      <section className="text-sm text-brand-black/65">
        <h2 className="font-semibold text-brand-black">Tips</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Downloads reflect data at the moment you click — they are not live links.</li>
          <li>Treat exported files like any other client information: store and share appropriately.</li>
          <li>
            Need a broader extract (all offices, message history, purge audit)? Use the admin or super
            admin portal.
          </li>
          <li>
            Need official PDF submissions? Use{" "}
            <a href="/dashboard/reporting" className="font-medium text-brand-green hover:underline">
              Reporting
            </a>
            , not this page.
          </li>
        </ul>
      </section>
    </div>
  );
}
