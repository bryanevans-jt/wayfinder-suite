import { FormalReportingWorkspace } from "@/components/formal-reporting-workspace";
import { canAccessFormalReporting } from "@/lib/staff-nav";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isAdminTierRole, staffHomePath } from "@wayfinder/supabase/roles";
import { redirect } from "next/navigation";

export default async function FormalReportingPage() {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;

  if (!canAccessFormalReporting(role)) {
    redirect(staffHomePath(role));
  }

  const readOnly = session?.isPreviewing ?? false;
  const showAdminLink = isAdminTierRole(role);

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Reporting</h1>
      <p className="mt-1 text-sm text-brand-black/60">
        Official GVRA and Tennessee submissions through Joshua Tree Reports.
      </p>
      <FormalReportingWorkspace readOnly={readOnly} showAdminLink={showAdminLink} />
    </main>
  );
}
