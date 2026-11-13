import { requireAppSession } from "@/lib/app-session";
import { FeedbackAdminList } from "@/components/feedback-admin-list";
import { isAdminTierRole } from "@wayfinder/supabase/roles";
import Link from "next/link";
import { redirect } from "next/navigation";

type Props = {
  searchParams?: Promise<{ id?: string }>;
};

export default async function FeedbackManagePage({ searchParams }: Props) {
  const session = await requireAppSession();
  if (!isAdminTierRole(session.actorRole)) {
    redirect("/dashboard/feedback");
  }
  const params = searchParams ? await searchParams : {};
  const highlightId = typeof params.id === "string" ? params.id : null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-brand-black">Team feedback</h1>
          <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
            Review problem reports and feature ideas from the team. Update the status as you work
            through them.
          </p>
        </div>
        <Link
          href="/dashboard/feedback"
          className="text-sm font-medium text-brand-green hover:underline"
        >
          Submit feedback
        </Link>
      </div>
      <div className="mt-8">
        <FeedbackAdminList highlightId={highlightId} />
      </div>
    </main>
  );
}
