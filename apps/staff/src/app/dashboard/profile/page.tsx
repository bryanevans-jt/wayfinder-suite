import { StaffProfileWorkspace } from "@/components/staff-profile-workspace";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isEsRole,
  isSupervisorRole,
  staffHomePath,
} from "@wayfinder/supabase/roles";
import { redirect } from "next/navigation";

export default async function StaffProfilePage() {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;

  if (
    !session ||
    (!isEsRole(role) && !isSupervisorRole(role) && !isAdminTierRole(role))
  ) {
    redirect(staffHomePath(role));
  }

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-black">My Profile</h1>
      <p className="mt-1 text-sm text-brand-black/60">
        Update how your name and contact details appear across Wayfinder Pro and Joshua Tree
        Reports.
      </p>
      <StaffProfileWorkspace />
    </main>
  );
}
