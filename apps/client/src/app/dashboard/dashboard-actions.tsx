import { PushNotificationsToggle, RegisterPasskeyButton, SignOutButton } from "@wayfinder/auth-ui";
import { ClientNotificationsBell } from "@/components/client-notifications-bell";

export function DashboardActions({
  allowPasskey = true,
  showNotifications = true,
}: {
  allowPasskey?: boolean;
  showNotifications?: boolean;
}) {
  return (
    <section id="account" className="scroll-mt-6 flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-brand-green">Account</h2>
      {showNotifications ? <ClientNotificationsBell /> : null}
      <PushNotificationsToggle />
      <div className="flex flex-wrap items-center gap-3">
        {allowPasskey ? <RegisterPasskeyButton /> : null}
        <SignOutButton />
      </div>
    </section>
  );
}
