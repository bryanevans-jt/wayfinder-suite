import { staffHomePath } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";

/**
 * `/dashboard` sends staff to their primary workspace.
 */
export default async function StaffDashboardPage() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  redirect(staffHomePath(session.effectiveRole));
}
