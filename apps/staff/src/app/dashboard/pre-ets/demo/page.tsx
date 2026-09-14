import { PreEtsProcessDemo } from "@/components/pre-ets-process-demo";
import { preEtsAccessAllowedForRole } from "@/lib/pre-ets-access";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";

export default async function PreEtsDemoPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const allowed = await preEtsAccessAllowedForRole(session.effectiveRole);
  if (!allowed) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PreEtsProcessDemo />
    </div>
  );
}
