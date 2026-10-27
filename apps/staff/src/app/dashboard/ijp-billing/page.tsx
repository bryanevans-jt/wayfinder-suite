import { IjpBillingWorkspace } from "@/components/ijp-billing-workspace";
import { createServerClient } from "@wayfinder/supabase";
import { canAccessIjpBilling } from "@wayfinder/supabase/ijp-billing-settings";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";

export default async function IjpBillingPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.actorUserId)
    .maybeSingle();

  const role = session.isPreviewing ? session.effectiveRole : (profile?.role as string);
  if (!profile?.is_active || !canAccessIjpBilling(role)) {
    redirect("/dashboard");
  }

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-10">
      <IjpBillingWorkspace />
    </main>
  );
}
