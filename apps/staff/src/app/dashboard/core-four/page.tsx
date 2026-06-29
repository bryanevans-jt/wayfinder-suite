import { CoreFourValuesContent } from "@/components/core-four-values-content";
import { requireAppSession } from "@/lib/app-session";
import { isCounselorRole } from "@wayfinder/supabase/roles";
import { notFound } from "next/navigation";

export default async function CoreFourPage() {
  const session = await requireAppSession();
  if (isCounselorRole(session.effectiveRole)) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-3xl font-semibold text-brand-black">Core Four</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        Our shared values guide how every team member serves clients, supports colleagues, and
        represents Joshua Tree in the community.
      </p>
      <CoreFourValuesContent />
    </main>
  );
}
