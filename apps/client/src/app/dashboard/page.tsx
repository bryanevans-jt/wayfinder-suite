import { PushNotificationPrompt } from "@wayfinder/auth-ui";
import { clientDisplayName, PwaInstallPrompt } from "@wayfinder/branding";
import { createServerClient, isSupportRole } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { ensureClientAuthProfile } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccessibilitySettings } from "@/components/accessibility-settings";
import { ClientCelebrationsCard } from "@/components/client-celebrations-card";
import { ClientOnboardingTour } from "@/components/client-onboarding-tour";
import {
  SupportClientPicker,
  type SupportClientOption,
} from "@/components/support-client-picker";
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

  if (authUser.user && !support) {
    try {
      const admin = createServiceRoleClient();
      await ensureClientAuthProfile(admin, authUser.user.id, authUser.user.email);
    } catch {
      // Service role may be unset in local dev; email-based lookup still applies after migration.
    }
  }

  const displayEmail = authUser.user?.email ?? session.effectiveUserId;

  const { data: a11yProfile } = await supabase
    .from("profiles")
    .select("accessibility_large_text, accessibility_high_contrast")
    .eq("id", session.effectiveUserId)
    .maybeSingle();

  let supportClients: SupportClientOption[] = [];
  if (support && authUser.user) {
    try {
      const admin = createServiceRoleClient();
      const { data: assignments } = await admin
        .from("support_client_assignments")
        .select("client_id")
        .eq("support_user_id", authUser.user.id);
      const clientIds = (assignments ?? []).map((a) => a.client_id as string);
      if (clientIds.length > 0) {
        const { data: clients } = await admin
          .from("clients")
          .select("id, contact_email, profile_id, user_id")
          .in("id", clientIds);
        const profileIds = [
          ...new Set(
            (clients ?? [])
              .map((c) => (c.user_id ?? c.profile_id) as string | null)
              .filter((id): id is string => Boolean(id))
          ),
        ];
        const { data: profiles } = profileIds.length
          ? await admin.from("profiles").select("id, full_name").in("id", profileIds)
          : { data: [] as { id: string; full_name: string | null }[] };
        const nameById = new Map(
          (profiles ?? []).map((p) => [p.id as string, p.full_name as string | null])
        );
        supportClients = (clients ?? []).map((c) => {
          const profileId = (c.user_id ?? c.profile_id) as string | null;
          return {
            id: c.id as string,
            label: clientDisplayName({
              full_name: profileId ? (nameById.get(profileId) ?? null) : null,
              contact_email: c.contact_email as string | null,
              id: c.id as string,
            }),
          };
        });
      }
    } catch {
      // Service role may be unset in local dev.
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-brand-white px-4 py-8 sm:gap-8 sm:px-6 sm:py-16">
      <PwaInstallPrompt productName="Wayfinder" storageKey="client-pwa-install-dismissed" />
      <ClientOnboardingTour />
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
      {support && supportClients.length > 1 ? (
        <Suspense fallback={null}>
          <SupportClientPicker clients={supportClients} selectedClientId={sp.client} />
        </Suspense>
      ) : null}
      <PushNotificationPrompt />
      <ClientCelebrationsCard />
      <SuccessPath selectedClientId={sp.client} />
      <ClientNextMeeting selectedClientId={sp.client} />
      <ClientApplicationsCard selectedClientId={sp.client} />
      <ClientActivity selectedClientId={sp.client} />
      {!support ? <ClientMessagesPanel /> : null}
      <DashboardActions allowPasskey={!support} />
      <AccessibilitySettings
        initialLargeText={Boolean(a11yProfile?.accessibility_large_text)}
        initialHighContrast={Boolean(a11yProfile?.accessibility_high_contrast)}
      />
    </main>
  );
}
