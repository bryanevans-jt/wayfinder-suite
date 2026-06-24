import {
  canAccessFormalReporting,
  isAdminTierRole,
  isCounselorRole,
  isEsRole,
  isSuperAdminRole,
  isSupervisorRole,
  isSupervisorTierRole,
  staffHomePath,
} from "@wayfinder/supabase/roles";

export { canAccessFormalReporting };

import type { WayfinderNavBadge } from "@wayfinder/branding";

export const COMMUNITY_PARTNERS_PATH = "/dashboard/community-partners";

const COUNSELOR_BLOCKED_PREFIXES = [
  "/dashboard/clients",
  "/dashboard/community-partners",
  "/dashboard/employer-network",
  "/dashboard/messages",
  "/dashboard/exports",
  "/dashboard/reporting",
  "/dashboard/analytics",
  "/dashboard/super-admin",
  "/dashboard/admin",
  "/dashboard/supervisor",
  "/dashboard/operations",
  "/dashboard/compliance",
  "/dashboard/timesheet",
  "/dashboard/audit",
];

const PORTAL_PREFIXES = [
  "/dashboard/super-admin",
  "/dashboard/admin",
  "/dashboard/supervisor",
];

export type StaffNavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

export type StaffNavSection = {
  /** Optional group label shown above a nav cluster. */
  label?: string;
  items: StaffNavItem[];
};

const reportingNav: StaffNavItem = {
  href: "/dashboard/reporting",
  label: "Reporting",
  match: (p) => p === "/dashboard/reporting",
};

const dataExportsNav: StaffNavItem = {
  href: "/dashboard/exports",
  label: "Data exports",
  match: (p) => p === "/dashboard/exports",
};

const communityPartnersNav: StaffNavItem = {
  href: COMMUNITY_PARTNERS_PATH,
  label: "Community Partners",
  match: (p) =>
    p.startsWith(COMMUNITY_PARTNERS_PATH) || p.startsWith("/dashboard/employer-network"),
};

const analyticsNav: StaffNavItem = {
  href: "/dashboard/analytics",
  label: "Analytics",
  match: (p) => p === "/dashboard/analytics",
};

const complianceNav: StaffNavItem = {
  href: "/dashboard/compliance",
  label: "Compliance",
  match: (p) => p === "/dashboard/compliance",
};

const operationsNav: StaffNavItem = {
  href: "/dashboard/operations",
  label: "Team operations",
  match: (p) => p === "/dashboard/operations",
};

const helpNav: StaffNavItem = {
  href: "/dashboard/help",
  label: "Help",
  match: (p) => p === "/dashboard/help",
};

function withHelpSections(sections: StaffNavSection[]): StaffNavSection[] {
  if (sections.some((s) => s.items.some((i) => i.href === helpNav.href))) {
    return sections;
  }
  return [...sections, { items: [helpNav] }];
}

/** Sidebar navigation grouped for clarity — daily work first, then oversight tools. */
export function staffNavSectionsForRole(
  staffRole: string | null,
  showAuditLink = false
): StaffNavSection[] {
  if (isCounselorRole(staffRole)) {
    return withHelpSections([
      {
        items: [
          {
            href: "/dashboard/counselor",
            label: "My clients",
            match: (p) => p.startsWith("/dashboard/counselor"),
          },
        ],
      },
    ]);
  }

  if (isSuperAdminRole(staffRole)) {
    const items: StaffNavItem[] = [
      {
        href: "/dashboard/super-admin",
        label: "Super admin portal",
        match: (p) => p.startsWith("/dashboard/super-admin"),
      },
    ];
    if (showAuditLink) {
      items.push({
        href: "/dashboard/audit",
        label: "Audit",
        match: (p) => p === "/dashboard/audit",
      });
    }
    return withHelpSections([
      { label: "Portal", items },
      {
        label: "Oversight",
        items: [operationsNav, complianceNav, analyticsNav],
      },
      {
        label: "Tools",
        items: [reportingNav, communityPartnersNav],
      },
    ]);
  }

  if (staffRole === "admin") {
    return withHelpSections([
      {
        label: "Portal",
        items: [
          {
            href: "/dashboard/admin",
            label: "Admin portal",
            match: (p) => p.startsWith("/dashboard/admin"),
          },
        ],
      },
      {
        label: "Oversight",
        items: [operationsNav, complianceNav, analyticsNav],
      },
      {
        label: "Tools",
        items: [reportingNav, communityPartnersNav],
      },
    ]);
  }

  if (isSupervisorRole(staffRole)) {
    return withHelpSections([
      {
        label: "Daily work",
        items: [
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
          {
            href: "/dashboard/timesheet",
            label: "Timesheet",
            match: (p) => p.startsWith("/dashboard/timesheet"),
          },
        ],
      },
      {
        label: "Oversight",
        items: [operationsNav, complianceNav, reportingNav, analyticsNav],
      },
      {
        label: "Tools",
        items: [dataExportsNav, communityPartnersNav],
      },
    ]);
  }

  if (staffRole === "accountant") {
    return withHelpSections([
      {
        label: "Payroll",
        items: [
          {
            href: "/dashboard/timesheet",
            label: "Timesheet",
            match: (p) => p.startsWith("/dashboard/timesheet"),
          },
          dataExportsNav,
        ],
      },
      {
        label: "Reference",
        items: [communityPartnersNav],
      },
    ]);
  }

  if (isEsRole(staffRole)) {
    return withHelpSections([
      {
        label: "Daily work",
        items: [
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
            href: "/dashboard/timesheet",
            label: "Timesheet",
            match: (p) => p.startsWith("/dashboard/timesheet"),
          },
          reportingNav,
        ],
      },
      {
        label: "Resources",
        items: [communityPartnersNav, analyticsNav, dataExportsNav],
      },
    ]);
  }

  return withHelpSections([
    {
      items: [
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
      ],
    },
  ]);
}

export function staffNavBadge(role: string | null | undefined): WayfinderNavBadge {
  if (isSuperAdminRole(role)) return "Super admin";
  if (isAdminTierRole(role) && !isSuperAdminRole(role)) return "Admin";
  if (isSupervisorTierRole(role) && !isAdminTierRole(role)) return "Supervisor";
  return isCounselorRole(role) ? "Counselor" : "Pro";
}

export function staffHomeHref(role: string | null | undefined): string {
  return staffHomePath(role);
}

export function isCounselorBlockedStaffPath(pathname: string): boolean {
  return COUNSELOR_BLOCKED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function portalPathForRole(role: string | null | undefined): string | null {
  if (isSuperAdminRole(role)) return "/dashboard/super-admin";
  if (role === "admin") return "/dashboard/admin";
  if (role === "supervisor") return "/dashboard/supervisor";
  return null;
}

export function isPortalPath(pathname: string): boolean {
  return PORTAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function portalPathAllowedForRole(
  pathname: string,
  role: string | null | undefined
): boolean {
  if (pathname.startsWith("/dashboard/super-admin")) {
    return isSuperAdminRole(role);
  }
  if (pathname.startsWith("/dashboard/admin")) {
    return isAdminTierRole(role);
  }
  if (pathname.startsWith("/dashboard/supervisor")) {
    return isSupervisorTierRole(role);
  }
  return true;
}

export function showStaffNotifications(role: string | null | undefined): boolean {
  const r = (role ?? "").trim().toLowerCase();
  return (
    r === "es" ||
    r === "supervisor" ||
    r === "admin" ||
    r === "super_admin" ||
    r === "counselor"
  );
}

export function staffWorkspaceLabel(staffRole: string | null): string {
  if (isCounselorRole(staffRole)) return "Counselor workspace";
  if (isSuperAdminRole(staffRole)) return "Super admin";
  if (isAdminTierRole(staffRole)) return "Admin workspace";
  if (isSupervisorRole(staffRole)) return "Supervisor workspace";
  if (isEsRole(staffRole)) return "Employment specialist";
  if (staffRole === "accountant") return "Accountant";
  return "Staff workspace";
}
