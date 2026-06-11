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
    <div className="flex flex-col gap-3">
      {showNotifications ? <ClientNotificationsBell /> : null}
      <PushNotificationsToggle />
      <div className="flex flex-wrap items-center gap-3">
        {allowPasskey ? <RegisterPasskeyButton /> : null}
        <SignOutButton />
      </div>
    </div>
  );
}
