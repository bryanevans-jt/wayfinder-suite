import { requireAppSession } from "@/lib/app-session";
import { FeedbackForm } from "@/components/feedback-form";
import { isAdminTierRole } from "@wayfinder/supabase/roles";

export default async function FeedbackPage() {
  const session = await requireAppSession();
  const showManageLink = isAdminTierRole(session.actorRole);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-semibold text-brand-black">
        Report a problem or suggest a feature
      </h1>
      <p className="mt-2 max-w-xl text-sm text-brand-black/75">
        Tell us what got in your way, or what would make Wayfinder Pro more helpful. Your note
        goes to the team that keeps the app running.
      </p>
      <div className="mt-8">
        <FeedbackForm showManageLink={showManageLink} />
      </div>
    </main>
  );
}
