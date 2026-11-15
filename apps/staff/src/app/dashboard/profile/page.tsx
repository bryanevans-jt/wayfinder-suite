import { StaffProfileWorkspace } from "@/components/staff-profile-workspace";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { canEditOwnStaffProfile, staffHomePath } from "@wayfinder/supabase/roles";
import { canUseStaffPto } from "@wayfinder/supabase/staff-pto-shared";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function StaffProfilePage() {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;

  if (!session || !canEditOwnStaffProfile(role)) {
    redirect(staffHomePath(role));
  }

  const showPtoLink = canUseStaffPto(role);

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-black">My Profile</h1>
      <p className="mt-1 text-sm text-brand-black/60">
        Update how your name and contact details appear across Wayfinder Pro and Joshua Tree Reports.
      </p>
      {showPtoLink ? (
        <p className="mt-3 text-sm text-brand-black/70">
          Need leave?{" "}
          <Link href="/dashboard/pto" className="font-medium text-brand-green underline">
            Open PTO
          </Link>{" "}
          to request or review paid time off.
        </p>
      ) : null}
      <StaffProfileWorkspace />
    </main>
  );
}
