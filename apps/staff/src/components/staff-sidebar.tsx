"use client";

import {
  isAdminTierRole,
  isCounselorRole,
  isEsRole,
  isSuperAdminRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMMUNITY_PARTNERS_PATH } from "@/lib/staff-nav";

const StaffSidebarAccount = dynamic(
  () =>
    import("./staff-sidebar-account").then((m) => ({
      default: m.StaffSidebarAccount,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="border-t border-neutral-200 p-4 text-xs text-brand-black/60">
        Loading account actions…
      </div>
    ),
  }
);

const StaffNotificationsBell = dynamic(
  () =>
    import("./staff-notifications-bell").then((m) => ({
      default: m.StaffNotificationsBell,
    })),
  { ssr: false }
);

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

const communityPartnersNav: NavItem = {
  href: COMMUNITY_PARTNERS_PATH,
  label: "Community Partners",
  match: (p) =>
    p.startsWith(COMMUNITY_PARTNERS_PATH) || p.startsWith("/dashboard/employer-network"),
};

const analyticsNav: NavItem = {
  href: "/dashboard/analytics",
  label: "Analytics",
  match: (p) => p === "/dashboard/analytics",
};

function navItemsForRole(staffRole: string | null, showAuditLink = false): NavItem[] {
  if (isCounselorRole(staffRole)) {
    return [
      {
        href: "/dashboard/counselor",
        label: "My clients",
        match: (p) => p.startsWith("/dashboard/counselor"),
      },
    ];
  }

  if (isSuperAdminRole(staffRole)) {
    const items: NavItem[] = [
      {
        href: "/dashboard/super-admin",
        label: "Super admin",
        match: (p) => p.startsWith("/dashboard/super-admin"),
      },
      analyticsNav,
      communityPartnersNav,
    ];
    if (showAuditLink) {
      items.push({
        href: "/dashboard/audit",
        label: "Audit",
        match: (p) => p === "/dashboard/audit",
      });
    }
    return items;
  }

  if (staffRole === "admin") {
    return [
      {
        href: "/dashboard/admin",
        label: "Admin portal",
        match: (p) => p.startsWith("/dashboard/admin"),
      },
      analyticsNav,
      communityPartnersNav,
    ];
  }

  if (isSupervisorRole(staffRole)) {
    return [
      {
        href: "/dashboard/supervisor",
        label: "Supervisor portal",
        match: (p) => p.startsWith("/dashboard/supervisor"),
      },
      {
        href: "/dashboard/messages",
        label: "Messages",
        match: (p) => p === "/dashboard/messages",
      },
      analyticsNav,
      {
        href: "/dashboard/exports",
        label: "Exports",
        match: (p) => p === "/dashboard/exports" || p === "/dashboard/reporting",
      },
    ];
  }

  if (isEsRole(staffRole)) {
    return [
      {
        href: "/dashboard/clients",
        label: "Clients",
        match: (p) => p.startsWith("/dashboard/clients"),
      },
      communityPartnersNav,
      {
        href: "/dashboard/messages",
        label: "Messages",
        match: (p) => p === "/dashboard/messages",
      },
      analyticsNav,
      {
        href: "/dashboard/exports",
        label: "Exports",
        match: (p) => p === "/dashboard/exports" || p === "/dashboard/reporting",
      },
    ];
  }

  return [
    {
      href: "/dashboard/clients",
      label: "Clients",
      match: (p) => p.startsWith("/dashboard/clients"),
    },
    {
      href: "/dashboard/messages",
      label: "Messages",
      match: (p) => p === "/dashboard/messages",
    },
    {
      href: "/dashboard/exports",
      label: "Exports",
      match: (p) => p === "/dashboard/exports" || p === "/dashboard/reporting",
    },
  ];
}

function showNotificationsForRole(staffRole: string | null): boolean {
  return (
    isEsRole(staffRole) ||
    isSupervisorRole(staffRole) ||
    isAdminTierRole(staffRole)
  );
}

type StaffSidebarProps = {
  staffRole: string | null;
  showAuditLink?: boolean;
};

export function StaffSidebar({ staffRole, showAuditLink = false }: StaffSidebarProps) {
  const pathname = usePathname() ?? "";
  const nav = navItemsForRole(staffRole, showAuditLink);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-brand-green">
          {isCounselorRole(staffRole)
            ? "Counselor workspace"
            : isSuperAdminRole(staffRole)
              ? "Super admin"
              : isAdminTierRole(staffRole)
                ? "Admin workspace"
                : isSupervisorRole(staffRole)
                  ? "Supervisor workspace"
                  : "Staff workspace"}
        </p>
        {showNotificationsForRole(staffRole) ? <StaffNotificationsBell /> : null}
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-brand-black/50">
          Menu
        </p>
        {nav.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-green/10 text-brand-green"
                  : "text-brand-black hover:bg-neutral-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <StaffSidebarAccount showPasskey={!isCounselorRole(staffRole)} />
    </aside>
  );
}
