import { ShareMomentForm } from "@/components/share-moment-form";
import { requireAppSession } from "@/lib/app-session";
import { createServerClient } from "@wayfinder/supabase";
import { isCounselorRole } from "@wayfinder/supabase/roles";
import { staffDisplayName } from "@wayfinder/branding";
import { notFound } from "next/navigation";

export default async function ShareMomentPage() {
  const session = await requireAppSession();
  if (isCounselorRole(session.effectiveRole)) {
    notFound();
  }
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session.actorUserId)
    .maybeSingle();

  const defaultTeamMemberName = staffDisplayName({
    full_name: (profile?.full_name as string | null) ?? null,
    email: user?.email ?? null,
    id: session.actorUserId,
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-3xl font-semibold text-brand-black">Share a Moment</h1>
      <p className="mt-2 text-sm text-brand-black/75">
        Upload photos from the field — first days on the job, mock interviews, meetings, and other
        wins. Submissions are emailed to leadership with your notes and photos attached.
      </p>
      <ShareMomentForm defaultTeamMemberName={defaultTeamMemberName} />
    </main>
  );
}
