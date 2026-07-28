import { WrtFacilitationWorkspace } from "@/components/wrt-facilitation-workspace";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { canUseWrtFacilitationPreview } from "@wayfinder/supabase/staff-wrt-shared";
import { redirect } from "next/navigation";

export default async function WrtFacilitationPreviewPage() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }
  if (!canUseWrtFacilitationPreview(session.effectiveRole)) {
    redirect("/dashboard");
  }

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-brand-black">WRT Facilitation</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        Preview of the staff facilitation workspace. Only admins can open this page for now.
      </p>
      <WrtFacilitationWorkspace />
    </main>
  );
}
