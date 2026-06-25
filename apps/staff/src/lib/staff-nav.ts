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
  label: "Data Exports",
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
  label: "Team Operations",
  match: (p) => p === "/dashboard/operations",
};

const profileNav: StaffNavItem = {
  href: "/dashboard/profile",
  label: "My Profile",
  match: (p) => p === "/dashboard/profile",
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

function canEditStaffProfile(role: string | null | undefined): boolean {
  return isEsRole(role) || isSupervisorRole(role) || isAdminTierRole(role);
}

function withHelpAndProfile(sections: StaffNavSection[], role: string | null): StaffNavSection[] {
  let out = sections;
  if (canEditStaffProfile(role)) {
    out = [...out, { label: "Account", items: [profileNav] }];
  }
  return withHelpSections(out);
}

/** Sidebar navigation grouped for clarity — daily work first, then oversight tools. */
export function staffNavSectionsForRole(
  staffRole: string | null,
  showAuditLink = false
): StaffNavSection[] {
  if (isCounselorRole(staffRole)) {
    return withHelpAndProfile(
      [
        {
          items: [
            {
              href: "/dashboard/counselor",
              label: "My Clients",
              match: (p) => p.startsWith("/dashboard/counselor"),
            },
          ],
        },
      ],
      staffRole
    );
  }

  if (isSuperAdminRole(staffRole)) {
    const items: StaffNavItem[] = [
      {
        href: "/dashboard/super-admin",
        label: "Super Admin Portal",
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
    return withHelpAndProfile(
      [
      { label: "Portal", items },
      {
        label: "Oversight",
        items: [operationsNav, complianceNav, analyticsNav],
      },
      {
        label: "Tools",
        items: [reportingNav, communityPartnersNav],
      },
    ],
      staffRole
    );
  }

  if (staffRole === "admin") {
    return withHelpAndProfile(
      [
      {
        label: "Portal",
        items: [
          {
            href: "/dashboard/admin",
            label: "Admin Portal",
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
    ],
      staffRole
    );
  }

  if (isSupervisorRole(staffRole)) {
    return withHelpAndProfile(
      [
      {
        label: "Daily Work",
        items: [
          {
            href: "/dashboard/supervisor",
            label: "Supervisor Portal",
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
    ],
      staffRole
    );
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
    return withHelpAndProfile(
      [
      {
        label: "Daily Work",
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
    ],
      staffRole
    );
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
  if (isCounselorRole(staffRole)) return "Counselor Workspace";
  if (isSuperAdminRole(staffRole)) return "Super Admin";
  if (isAdminTierRole(staffRole)) return "Admin Workspace";
  if (isSupervisorRole(staffRole)) return "Supervisor Workspace";
  if (isEsRole(staffRole)) return "Employment Specialist";
  if (staffRole === "accountant") return "Accountant";
  return "Staff Workspace";
}
