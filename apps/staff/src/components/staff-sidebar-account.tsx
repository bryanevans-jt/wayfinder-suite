"use client";

import { PushNotificationsToggle, RegisterPasskeyButton, SignOutButton } from "@wayfinder/auth-ui";

type Props = {
  showPasskey?: boolean;
};

export function StaffSidebarAccount({ showPasskey = true }: Props) {
  return (
    <div className="space-y-2 border-t border-neutral-200 p-4">
      <PushNotificationsToggle />
      {showPasskey ? <RegisterPasskeyButton /> : null}
      <SignOutButton />
    </div>
  );
}
