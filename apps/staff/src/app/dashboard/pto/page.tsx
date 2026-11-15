import { StaffPtoPanel } from "@/components/staff-pto-panel";
import { canUseStaffPto } from "@wayfinder/supabase/staff-pto-shared";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { staffHomePath } from "@wayfinder/supabase/roles";
import { redirect } from "next/navigation";

export default async function StaffPtoPage() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  const role = session.effectiveRole;
  if (!canUseStaffPto(role)) {
    redirect(staffHomePath(role));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-brand-green">PTO</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        Request paid time off, track status, and (for Admins) manage the organization queue.
        Counselors and clients do not use PTO in Wayfinder Pro.
      </p>
      <div className="mt-8">
        <StaffPtoPanel />
      </div>
    </main>
  );
}
