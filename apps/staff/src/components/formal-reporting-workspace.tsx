import { buildReportsAppUrl } from "@wayfinder/branding";
import { ReportingVsExportsGuide } from "@/components/reporting-vs-exports-guide";

type Props = {
  readOnly?: boolean;
  showAdminLink?: boolean;
};

export function FormalReportingWorkspace({ readOnly = false, showAdminLink = false }: Props) {
  const reportsUrl = buildReportsAppUrl("/reports");
  const adminUrl = buildReportsAppUrl("/admin");

  return (
    <div className="mt-6 max-w-3xl space-y-6">
      {readOnly ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Read-only preview — report submission opens in the reporting workspace.
        </p>
      ) : null}

      <ReportingVsExportsGuide
        context="reporting"
        reportingAction={{ href: reportsUrl, label: "Open Reporting Workspace" }}
      />

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-brand-black">Fastest path</h2>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm text-brand-black/80">
          <li>
            Open a <strong>client profile</strong> and use <strong>Generate Activity Report</strong>{" "}
            if you want a draft summary — then choose <strong>Official Reporting</strong> in that
            section so the client name is pre-filled.
          </li>
          <li>
            Or use <strong>Open reporting workspace</strong> above to pick state, report type, and
            client from your caseload.
          </li>
          <li>Review every field, sign, and submit — you receive a confirmation email with the PDF.</li>
        </ol>
        {showAdminLink ? (
          <p className="mt-4 border-t border-neutral-100 pt-4 text-sm text-brand-black/70">
            Templates and Drive folders:{" "}
            <a
              href={adminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-green hover:underline"
            >
              Reports admin portal ↗
            </a>
          </p>
        ) : null}
      </section>
    </div>
  );
}
