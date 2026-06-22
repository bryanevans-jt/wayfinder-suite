import { JT_VOCATIONAL_REPORTS_URL } from "@wayfinder/branding";
import { ReportingVsExportsGuide } from "@/components/reporting-vs-exports-guide";

type Props = {
  readOnly?: boolean;
};

export function FormalReportingWorkspace({ readOnly = false }: Props) {
  return (
    <div className="mt-8 max-w-3xl space-y-8">
      {readOnly ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Read-only preview — report submission opens in Joshua Tree Reports.
        </p>
      ) : null}

      <ReportingVsExportsGuide context="reporting" />

      <section className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-6">
        <h2 className="text-lg font-semibold text-brand-black">Open Joshua Tree Reports</h2>
        <p className="mt-2 text-sm text-brand-black/80">
          Submit official progress notes and monthly reports (SE Monthly, VPR, JTSG VMR, EVF, time
          sheets). Each submission creates a PDF, saves it to Google Drive, and emails you a
          confirmation.
        </p>
        <a
          href={JT_VOCATIONAL_REPORTS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-gold/90"
        >
          Open Joshua Tree Reports
        </a>
        <p className="mt-3 text-xs text-brand-black/55">
          Opens in a new tab · Sign in with your @thejoshuatree.org Google account
        </p>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-brand-black">Start from Wayfinder Pro</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-brand-black/80">
          <li>
            On a client profile, use <strong>Monthly activity report</strong> to build summary text,
            then open <strong>Joshua Tree Reports</strong> from that same section — the client name
            is filled in for you.
          </li>
          <li>
            You can change every field in Joshua Tree Reports before you sign and submit.
          </li>
          <li>
            Counselors and clients do not use Joshua Tree Reports. Employment Specialists,
            supervisors, and administrators can open it from the Reporting menu.
          </li>
        </ul>
      </section>
    </div>
  );
}
