import Link from "next/link";

type Props = {
  /** Which page is hosting the guide — highlights that row. */
  context: "reporting" | "exports";
  showReportingLink?: boolean;
};

export function ReportingVsExportsGuide({ context, showReportingLink = false }: Props) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <h2 className="text-base font-semibold text-brand-black">Reporting vs data in Wayfinder Pro</h2>
      <p className="mt-2 text-sm text-brand-black/75">
        These are separate tools. Pick the one that matches what you need — they do not replace each
        other.
      </p>
      <dl className="mt-4 space-y-4 text-sm">
        <div
          className={`rounded-lg border p-4 ${
            context === "reporting"
              ? "border-brand-green/40 bg-brand-green/5"
              : "border-neutral-200 bg-white"
          }`}
        >
          <dt className="font-semibold text-brand-black">Reporting</dt>
          <dd className="mt-1 text-brand-black/80">
            <strong>Joshua Tree Reports</strong> — official progress notes and monthly submissions
            (SE Monthly, VPR, JTSG VMR, EVF, time sheets). Creates PDFs, files to Google Drive, and
            emails confirmations. Opens in a separate app.
          </dd>
          {context !== "reporting" && showReportingLink ? (
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
            <strong>Wayfinder Pro</strong> — on-demand CSV downloads of caseload, applications,
            activity, and timesheets for spreadsheets, supervision prep, and local record-keeping.
            Does not submit reports or generate compliance PDFs.
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
            <strong>Wayfinder Pro</strong> — dashboards and org-wide metrics for leadership and
            grant reporting. Live charts, not CSV downloads or PDF submissions.
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
