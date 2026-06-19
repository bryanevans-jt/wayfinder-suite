import { ExportsWorkspace } from "@/components/exports-workspace";
import { getAppSession } from "@wayfinder/supabase/preview-server";

export default async function ExportsPage() {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;
  const readOnly = session?.isPreviewing ?? false;

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Data exports</h1>
      <p className="mt-2 max-w-2xl text-brand-black/75">
        Download CSV snapshots from Wayfinder Pro for spreadsheets and internal analysis. For
        official PDF submissions, use{" "}
        <a href="/dashboard/reporting" className="font-medium text-brand-green hover:underline">
          Reporting
        </a>
        . For live org metrics, use{" "}
        <a href="/dashboard/analytics" className="font-medium text-brand-green hover:underline">
          Analytics
        </a>
        .
      </p>
      <ExportsWorkspace role={role} readOnly={readOnly} />
    </main>
  );
}
