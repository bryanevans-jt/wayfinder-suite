import Link from "next/link";

type ReportingAction = {
  href: string;
  label: string;
};

type Props = {
  /** Which page is hosting the guide — highlights that row. */
  context: "reporting" | "exports";
  showReportingLink?: boolean;
  /** Primary CTA when on the Reporting page — shown inside the Reporting card. */
  reportingAction?: ReportingAction;
};

export function ReportingVsExportsGuide({
  context,
  showReportingLink = false,
  reportingAction,
}: Props) {
  const isReportingPage = context === "reporting";

  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <h2 className="text-base font-semibold text-brand-black">
        {isReportingPage ? "What this page is for" : "Reporting vs data in Wayfinder Pro"}
      </h2>
      <p className="mt-2 text-sm text-brand-black/75">
        {isReportingPage
          ? "Use Joshua Tree Reports for official funder paperwork. Wayfinder Pro handles casework, CSV exports, and analytics separately."
          : "These are different tools. Pick the one that matches what you need — they do not replace each other."}
      </p>
      <dl className="mt-4 space-y-4 text-sm">
        <div
          className={`rounded-lg border p-4 ${
            isReportingPage
              ? "border-brand-green/40 bg-brand-green/5"
              : "border-neutral-200 bg-white"
          }`}
        >
          <dt className="font-semibold text-brand-black">Reporting</dt>
          <dd className="mt-1 text-brand-black/80">
            <strong>Joshua Tree Reports</strong> — official progress notes and monthly submissions
            (SE Monthly, VPR, JTSG VMR, EVF, time sheets). Each submission creates a PDF, saves it
            to Google Drive, and emails you a confirmation.
          </dd>
          {reportingAction ? (
            <dd className="mt-4 space-y-3">
              <a
                href={reportingAction.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-gold/90"
              >
                {reportingAction.label}
                <span aria-hidden="true">↗</span>
              </a>
              <p className="text-xs text-brand-black/55">
                Opens Joshua Tree Reports · Same Wayfinder sign-in · GA and TN by client office ·
                Missing SE Monthly alerts appear on your dashboard
              </p>
            </dd>
          ) : null}
          {!isReportingPage && showReportingLink ? (
            <dd className="mt-2">
              <Link
                href="/dashboard/reporting"
                className="text-sm font-medium text-brand-green hover:underline"
              >
                Go to Reporting →
              </Link>
            </dd>
          ) : null}
        </div>
        <div
          className={`rounded-lg border p-4 ${
            context === "exports"
              ? "border-brand-green/40 bg-brand-green/5"
              : "border-neutral-200 bg-white"
          }`}
        >
          <dt className="font-semibold text-brand-black">Data exports</dt>
          <dd className="mt-1 text-brand-black/80">
            <strong>Wayfinder Pro</strong> — download spreadsheet files (CSV) of caseload,
            applications, activity, and timesheets when you need numbers in Excel or for meetings.
            Does not submit official reports or create compliance PDFs.
          </dd>
          {context !== "exports" ? (
            <dd className="mt-2">
              <Link
                href="/dashboard/exports"
                className="text-sm font-medium text-brand-green hover:underline"
              >
                Go to Data exports →
              </Link>
            </dd>
          ) : null}
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <dt className="font-semibold text-brand-black">Analytics</dt>
          <dd className="mt-1 text-brand-black/80">
            <strong>Wayfinder Pro</strong> — charts and organization-wide numbers for leadership and
            grant reporting. Live views, not spreadsheet downloads or PDF submissions.
          </dd>
          <dd className="mt-2">
            <Link
              href="/dashboard/analytics"
              className="text-sm font-medium text-brand-green hover:underline"
            >
              Go to Analytics →
            </Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}
