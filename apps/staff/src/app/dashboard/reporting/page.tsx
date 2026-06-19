import { FormalReportingWorkspace } from "@/components/formal-reporting-workspace";
import { canAccessFormalReporting } from "@/lib/staff-nav";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { staffHomePath } from "@wayfinder/supabase/roles";
import { redirect } from "next/navigation";

export default async function FormalReportingPage() {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;

  if (!canAccessFormalReporting(role)) {
    redirect(staffHomePath(role));
  }

  const readOnly = session?.isPreviewing ?? false;

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Reporting</h1>
      <p className="mt-2 max-w-2xl text-brand-black/75">
        Official funder and compliance submissions through Joshua Tree Reports. This is separate from{" "}
        <a href="/dashboard/exports" className="font-medium text-brand-green hover:underline">
          Data exports
        </a>{" "}
        (CSV downloads) and{" "}
        <a href="/dashboard/analytics" className="font-medium text-brand-green hover:underline">
          Analytics
        </a>{" "}
        (org dashboards) in Wayfinder Pro.
      </p>
      <FormalReportingWorkspace readOnly={readOnly} />
    </main>
  );
}
