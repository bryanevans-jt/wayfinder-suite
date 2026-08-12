import { WrtFacilitationWorkspace } from "@/components/wrt-facilitation-workspace";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { canUseWrtFacilitationPreview } from "@wayfinder/supabase/staff-wrt-shared";
import { staffHomePath } from "@wayfinder/supabase/roles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function WrtFacilitationPreviewPage() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }
  if (!canUseWrtFacilitationPreview(session.effectiveRole)) {
    redirect(staffHomePath(session.effectiveRole));
  }

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-brand-black">WRT Facilitation</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        Staff facilitation workspace for Workplace Readiness Training (Admin, Super Admin, and WRT Admin).
        Manage modules and lessons under{" "}
        <Link href="/dashboard/wrt/curriculum" className="font-medium text-brand-green hover:underline">
          WRT Curriculum
        </Link>
        .
      </p>
      <WrtFacilitationWorkspace />
    </main>
  );
}
