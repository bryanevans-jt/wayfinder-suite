import { buildReportsAppUrl } from "@wayfinder/branding";
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

  redirect(buildReportsAppUrl("/reports"));
}
