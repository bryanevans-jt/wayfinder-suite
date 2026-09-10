import { PushNotificationsToggle, RegisterPasskeyButton, SignOutButton } from "@wayfinder/auth-ui";
import { ClientNotificationsBell } from "@/components/client-notifications-bell";
import { CLIENT_DASHBOARD_SECTION_IDS as IDS } from "@/lib/dashboard-section-ids";
import { CLIENT_DASHBOARD_SECTIONS as LABELS } from "@/lib/dashboard-section-labels";

export function DashboardActions({
  allowPasskey = true,
  showNotifications = true,
}: {
  allowPasskey?: boolean;
  showNotifications?: boolean;
}) {
  return (
    <section
      id={IDS.account}
      aria-labelledby={IDS.accountHeading}
      className="scroll-mt-6 flex flex-col gap-3"
    >
      <h2 id={IDS.accountHeading} className="text-lg font-semibold text-brand-green">
        {LABELS.account}
      </h2>
      {showNotifications ? <ClientNotificationsBell /> : null}
      <PushNotificationsToggle />
      <div className="flex flex-wrap items-center gap-3">
        {allowPasskey ? <RegisterPasskeyButton /> : null}
        <SignOutButton />
      </div>
    </section>
  );
}
