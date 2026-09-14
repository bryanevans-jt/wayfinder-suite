import { PreEtsFieldDeliveryDemo } from "@/components/pre-ets-field-delivery-demo";
import { preEtsAccessAllowedForRole } from "@/lib/pre-ets-access";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";

export default async function PreEtsFieldDeliveryDemoPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const allowed = await preEtsAccessAllowedForRole(session.effectiveRole);
  if (!allowed) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PreEtsFieldDeliveryDemo variant="dashboard" />
    </div>
  );
}
