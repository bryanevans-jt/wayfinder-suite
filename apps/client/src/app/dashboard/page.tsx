import { createServerClient, isSupportRole } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";
import { ClientActivity } from "./client-activity";
import { ClientApplicationsCard } from "./client-applications-card";
import { ClientMessagesPanel } from "./client-messages";
import { ClientNextMeeting } from "./client-next-meeting";
import { DashboardActions } from "./dashboard-actions";
import { SuccessPath } from "./success-path";

type DashboardSearchParams = Promise<{ client?: string }>;

export default async function ClientDashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const sp = await searchParams;
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = await createServerClient();
  const { data: authUser } = await supabase.auth.getUser();
  const support = isSupportRole(session.effectiveRole);
  const displayEmail = authUser.user?.email ?? session.effectiveUserId;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-brand-white px-4 py-8 sm:gap-8 sm:px-6 sm:py-16">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-green sm:text-sm">
          Wayfinder · {support ? "Support dashboard" : "Client dashboard"}
        </p>
        <h1 className="text-2xl font-semibold text-brand-green sm:text-3xl">Welcome</h1>
        <p className="text-brand-black/85">
          Signed in as{" "}
          <span className="font-medium text-brand-green">{displayEmail}</span>
        </p>
      </header>
      <SuccessPath selectedClientId={sp.client} />
      <ClientNextMeeting selectedClientId={sp.client} />
      <ClientApplicationsCard selectedClientId={sp.client} />
      <ClientActivity selectedClientId={sp.client} />
      {!support ? <ClientMessagesPanel /> : null}
      <DashboardActions allowPasskey={!support} />
    </main>
  );
}
