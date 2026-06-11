import { AnalyticsWorkspace } from "@/components/analytics-workspace";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";
import {
  isAdminTierRole,
  isEsRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";

export default async function AnalyticsPage() {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;

  if (
    !session ||
    (!isEsRole(role) && !isSupervisorRole(role) && !isAdminTierRole(role))
  ) {
    redirect("/dashboard");
  }

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Analytics</h1>
      <p className="mt-2 max-w-3xl text-sm text-brand-black/75">
        Key employment outcomes from your Wayfinder data — hire rates, time to hire, and
        application activity. Numbers use the same definitions every time and can be exported
        for leadership or grant reporting.
      </p>
      <AnalyticsWorkspace readOnly={session.isPreviewing} />
    </main>
  );
}
