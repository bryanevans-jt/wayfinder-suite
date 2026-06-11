"use client";

import { isEsRole, isSupervisorRole } from "@wayfinder/supabase/roles";

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
      "Contact logs, job applications, and stage changes for your assigned clients (most recent first).",
    href: "/api/exports/activity",
    filename: "wayfinder-client-activity.csv",
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

  return (
    <div className="mt-8 max-w-3xl space-y-8">
      {readOnly ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Read-only preview — CSV downloads still reflect this user&apos;s scope.
        </p>
      ) : null}
      <section className="rounded-xl border border-brand-green/25 bg-brand-green/5 p-5">
        <h2 className="text-base font-semibold text-brand-black">What Exports is for</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-brand-black/80">
          <li>
            <strong>On-demand CSV downloads</strong> for internal use — caseload snapshots,
            application lists, activity timelines, and similar operational data you want in a
            spreadsheet.
          </li>
          <li>
            <strong>Your working data in Wayfinder</strong>, pulled when you need it for
            supervision prep, team meetings, or local record-keeping.
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <h2 className="text-base font-semibold text-brand-black">What Exports is not</h2>
        <p className="mt-2 text-sm text-brand-black/80">
          This is <strong>not</strong> formal <strong>Reporting</strong> — the separate
          compliance and funder submission process your organization runs outside Wayfinder.
          Nothing here replaces that workflow or submits data on your behalf.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">Available downloads</h2>
        {!canDownload ? (
          <p className="text-sm text-brand-black/70">
            Downloads are available to <strong>Employment Specialists</strong> and{" "}
            <strong>supervisors</strong> (applications). Administrators can export org-wide
            activity from the <strong>Activity logs</strong> tab in the admin or supervisor
            portal, and review messages under <strong>Message audit</strong> (admin tier).
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
                href={item.href}
                className="mt-4 inline-flex w-fit rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white"
              >
                Download CSV
              </a>
              <p className="mt-2 text-xs text-brand-black/45">{item.filename}</p>
            </article>
          ))}
        </div>
        {isSupervisorRole(role) ? (
          <p className="text-xs text-brand-black/60">
            As a supervisor, applications include every client assigned to ES staff in your
            scope.
          </p>
        ) : null}
      </section>

      <section className="text-sm text-brand-black/65">
        <h2 className="font-semibold text-brand-black">Tips</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Downloads reflect data at the moment you click — they are not live links.</li>
          <li>Treat exported files like any other client information: store and share appropriately.</li>
          <li>
            Need a broader extract (all offices, message history, purge audit)? Use the admin or
            super admin portal.
          </li>
        </ul>
      </section>
    </div>
  );
}
