import { WrtCurriculumPanel } from "@/components/wrt-curriculum-panel";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { canManageWrtCurriculum } from "@wayfinder/supabase/staff-wrt-shared";
import { staffHomePath } from "@wayfinder/supabase/roles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function WrtCurriculumPage() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }
  if (!canManageWrtCurriculum(session.effectiveRole)) {
    redirect(staffHomePath(session.effectiveRole));
  }

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/wrt"
          className="text-sm font-medium text-brand-green hover:underline"
        >
          ← WRT Facilitation
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-brand-black">WRT Curriculum</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        Manage Workplace Readiness Training modules, lessons, and content blocks. Available to Admin,
        Super Admin, and WRT Admin.
      </p>
      <div className="mt-6">
        <WrtCurriculumPanel />
      </div>
    </main>
  );
}
