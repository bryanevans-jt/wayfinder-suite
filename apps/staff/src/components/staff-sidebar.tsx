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
  external?: boolean;
};

const reportingNav: NavItem = {
  href: "/dashboard/reporting",
  label: "Reporting",
  match: (p) => p === "/dashboard/reporting",
};

const dataExportsNav: NavItem = {
  href: "/dashboard/exports",
  label: "Data exports",
  match: (p) => p === "/dashboard/exports",
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

const helpNav: NavItem = {
  href: "/dashboard/help",
  label: "Help",
  match: (p) => p === "/dashboard/help",
};

function withHelp(items: NavItem[]): NavItem[] {
  if (items.some((i) => i.href === helpNav.href)) {
    return items;
  }
  return [...items, helpNav];
}

function navItemsForRole(staffRole: string | null, showAuditLink = false): NavItem[] {
  if (isCounselorRole(staffRole)) {
    return withHelp([
      {
        href: "/dashboard/counselor",
        label: "My clients",
        match: (p) => p.startsWith("/dashboard/counselor"),
      },
    ]);
  }

  if (isSuperAdminRole(staffRole)) {
    const items: NavItem[] = [
      {
        href: "/dashboard/super-admin",
        label: "Super admin",
        match: (p) => p.startsWith("/dashboard/super-admin"),
      },
      analyticsNav,
      reportingNav,
      communityPartnersNav,
    ];
    if (showAuditLink) {
      items.push({
        href: "/dashboard/audit",
        label: "Audit",
        match: (p) => p === "/dashboard/audit",
      });
    }
    return withHelp(items);
  }

  if (staffRole === "admin") {
    return withHelp([
      {
        href: "/dashboard/admin",
        label: "Admin portal",
        match: (p) => p.startsWith("/dashboard/admin"),
      },
      analyticsNav,
      reportingNav,
      communityPartnersNav,
    ]);
  }

  if (isSupervisorRole(staffRole)) {
    return withHelp([
      {
        href: "/dashboard/supervisor",
        label: "Supervisor portal",
        match: (p) => p.startsWith("/dashboard/supervisor"),
      },
      {
        href: "/dashboard/timesheet",
        label: "Timesheet",
        match: (p) => p.startsWith("/dashboard/timesheet"),
      },
      {
        href: "/dashboard/messages",
        label: "Messages",
        match: (p) => p === "/dashboard/messages",
      },
      communityPartnersNav,
      analyticsNav,
      dataExportsNav,
      reportingNav,
    ]);
  }

  if (staffRole === "accountant") {
    return withHelp([
      {
        href: "/dashboard/timesheet",
        label: "Timesheet",
        match: (p) => p.startsWith("/dashboard/timesheet"),
      },
      communityPartnersNav,
      dataExportsNav,
    ]);
  }

  if (isEsRole(staffRole)) {
    return withHelp([
      {
        href: "/dashboard/clients",
        label: "Clients",
        match: (p) => p.startsWith("/dashboard/clients"),
      },
      {
        href: "/dashboard/timesheet",
        label: "Timesheet",
        match: (p) => p.startsWith("/dashboard/timesheet"),
      },
      communityPartnersNav,
      {
        href: "/dashboard/messages",
        label: "Messages",
        match: (p) => p === "/dashboard/messages",
      },
      analyticsNav,
      dataExportsNav,
      reportingNav,
    ]);
  }

  return withHelp([
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
    dataExportsNav,
  ]);
}

function showNotificationsForRole(staffRole: string | null): boolean {
  return (
    isEsRole(staffRole) ||
    isSupervisorRole(staffRole) ||
    isAdminTierRole(staffRole)
  );
}

function workspaceLabel(staffRole: string | null): string {
  if (isCounselorRole(staffRole)) return "Counselor workspace";
  if (isSuperAdminRole(staffRole)) return "Super admin";
  if (isAdminTierRole(staffRole)) return "Admin workspace";
  if (isSupervisorRole(staffRole)) return "Supervisor workspace";
  return "Staff workspace";
}

export type StaffSidebarPanelProps = {
  staffRole: string | null;
  showAuditLink?: boolean;
  onNavigate?: () => void;
  className?: string;
};

export function StaffSidebarPanel({
  staffRole,
  showAuditLink = false,
  onNavigate,
  className = "",
}: StaffSidebarPanelProps) {
  const pathname = usePathname() ?? "";
  const nav = navItemsForRole(staffRole, showAuditLink);

  return (
    <div className={`flex min-h-0 flex-col ${className}`.trim()}>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-brand-green">
          {workspaceLabel(staffRole)}
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
              onClick={onNavigate}
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
    </div>
  );
}

type StaffSidebarProps = {
  staffRole: string | null;
  showAuditLink?: boolean;
};

/** @deprecated Prefer StaffDashboardShell for responsive layout. */
export function StaffSidebar({ staffRole, showAuditLink = false }: StaffSidebarProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <StaffSidebarPanel staffRole={staffRole} showAuditLink={showAuditLink} />
    </aside>
  );
}
