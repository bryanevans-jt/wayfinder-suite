"use client";

import { isCounselorRole } from "@wayfinder/supabase/roles";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  showStaffNotifications,
  staffNavSectionsForRole,
  staffWorkspaceLabel,
} from "@/lib/staff-nav";

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
  const sections = staffNavSectionsForRole(staffRole, showAuditLink);

  return (
    <div className={`flex min-h-0 flex-col ${className}`.trim()}>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-brand-green">
          {staffWorkspaceLabel(staffRole)}
        </p>
        {showStaffNotifications(staffRole) ? <StaffNotificationsBell /> : null}
        {sections.map((section, sectionIndex) => (
          <div key={section.label ?? `section-${sectionIndex}`} className={sectionIndex > 0 ? "mt-3" : ""}>
            {section.label ? (
              <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-brand-black/45">
                {section.label}
              </p>
            ) : sectionIndex === 0 ? (
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-brand-black/50">
                Menu
              </p>
            ) : null}
            {section.items.map((item) => {
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
        ))}
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
