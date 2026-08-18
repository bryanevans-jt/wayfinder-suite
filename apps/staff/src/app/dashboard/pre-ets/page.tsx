import { PreEtsWorkspace } from "@/components/pre-ets-workspace";
import { preEtsAccessAllowedForRole } from "@/lib/pre-ets-access";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { staffHomePath } from "@wayfinder/supabase/roles";
import { redirect } from "next/navigation";

export default async function PreEtsDashboardPage() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }
  const allowed = await preEtsAccessAllowedForRole(session.effectiveRole);
  if (!allowed) {
    redirect(staffHomePath(session.effectiveRole));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PreEtsWorkspace />
    </div>
  );
}
