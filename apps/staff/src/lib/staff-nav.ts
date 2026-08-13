import {
  canAccessFormalReporting,
  canEditOwnStaffProfile,
  isAdminTierRole,
  isCounselorRole,
  isEsRole,
  isHospitalitySpecialistRole,
  isHrRole,
  isSuperAdminRole,
  isSupervisorRole,
  isSupervisorTierRole,
  isWrtAdminRole,
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
  "/dashboard/intake-billing",
  "/dashboard/time-clock",
  "/dashboard/audit",
  "/dashboard/share-moments",
  "/dashboard/core-four",
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

const timeClockNav: StaffNavItem = {
  href: "/dashboard/time-clock",
  label: "Time Clock",
  match: (p) => p.startsWith("/dashboard/time-clock"),
};

const reportingNav: StaffNavItem = {
  href: "/dashboard/reporting",
  label: "Submit Reports",
  match: (p) => p === "/dashboard/reporting",
};

const dataExportsNav: StaffNavItem = {
  href: "/dashboard/exports",
  label: "Download Exports",
  match: (p) => p === "/dashboard/exports",
};

const intakeBillingNav: StaffNavItem = {
  href: "/dashboard/intake-billing",
  label: "Intake Billing",
  match: (p) => p.startsWith("/dashboard/intake-billing"),
};

const communityPartnersNav: StaffNavItem = {
  href: COMMUNITY_PARTNERS_PATH,
  label: "Community Partners",
  match: (p) =>
    p.startsWith(COMMUNITY_PARTNERS_PATH) || p.startsWith("/dashboard/employer-network"),
};

const analyticsNav: StaffNavItem = {
  href: "/dashboard/analytics",
  label: "Explore Analytics",
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

const coreFourNav: StaffNavItem = {
  href: "/dashboard/core-four",
  label: "Core Four",
  match: (p) => p === "/dashboard/core-four",
};

const shareMomentsNav: StaffNavItem = {
  href: "/dashboard/share-moments",
  label: "Share a Moment",
  match: (p) => p === "/dashboard/share-moments",
};

const cultureNavSection: StaffNavSection = {
  label: "Our Team",
  items: [coreFourNav, shareMomentsNav],
};

function withCultureAndHelp(sections: StaffNavSection[]): StaffNavSection[] {
  return withHelpSections([...sections, cultureNavSection]);
}

function withHelpSections(sections: StaffNavSection[]): StaffNavSection[] {
  if (sections.some((s) => s.items.some((i) => i.href === helpNav.href))) {
    return sections;
  }
  return [...sections, { items: [helpNav] }];
}

function withHelpAndProfile(sections: StaffNavSection[], role: string | null): StaffNavSection[] {
  let out = sections;
  if (canEditOwnStaffProfile(role)) {
    out = [...out, { label: "Account", items: [profileNav] }];
  }
  return withCultureAndHelp(out);
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
            label: "My Clients",
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
          items: [
            timeClockNav,
            {
              href: "/dashboard/wrt",
              label: "WRT Preview",
              match: (p) => p.startsWith("/dashboard/wrt"),
            },
            reportingNav,
            {
              href: "/dashboard/referrals",
              label: "Referral Queue",
              match: (p) => p.startsWith("/dashboard/referrals"),
            },
            intakeBillingNav,
            communityPartnersNav,
          ],
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
          items: [
            timeClockNav,
            {
              href: "/dashboard/wrt",
              label: "WRT Preview",
              match: (p) => p.startsWith("/dashboard/wrt"),
            },
            reportingNav,
            {
              href: "/dashboard/referrals",
              label: "Referral Queue",
              match: (p) => p.startsWith("/dashboard/referrals"),
            },
            intakeBillingNav,
            communityPartnersNav,
          ],
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
            timeClockNav,
            {
              href: "/dashboard/timesheet",
              label: "Weekly Timesheet",
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
    return withHelpAndProfile(
      [
        {
          label: "Accounts",
          items: [
            intakeBillingNav,
            {
              href: "/dashboard/timesheet",
              label: "Weekly Timesheet",
              match: (p) => p.startsWith("/dashboard/timesheet"),
            },
            timeClockNav,
            dataExportsNav,
          ],
        },
        {
          label: "Reference",
          items: [communityPartnersNav],
        },
      ],
      staffRole
    );
  }

  if (isHrRole(staffRole)) {
    return withHelpAndProfile(
      [
        {
          label: "HR",
          items: [
            {
              href: "/dashboard/hr",
              label: "HR Dashboard",
              match: (p) => p.startsWith("/dashboard/hr"),
            },
            {
              href: "/dashboard/referrals",
              label: "Referral Queue",
              match: (p) => p.startsWith("/dashboard/referrals"),
            },
            intakeBillingNav,
            {
              href: "/dashboard/hospitality",
              label: "Hospitality Overview",
              match: (p) => p === "/dashboard/hospitality",
            },
            {
              href: "/dashboard/hospitality/check-ins",
              label: "Weekly Check-ins",
              match: (p) => p.startsWith("/dashboard/hospitality/check-ins"),
            },
            {
              href: "/dashboard/hospitality/partner-check-ins",
              label: "Partner Check-ins",
              match: (p) => p.startsWith("/dashboard/hospitality/partner-check-ins"),
            },
            {
              href: "/dashboard/timesheet",
              label: "Weekly Timesheet",
              match: (p) => p.startsWith("/dashboard/timesheet"),
            },
            timeClockNav,
            analyticsNav,
            dataExportsNav,
          ],
        },
      ],
      staffRole
    );
  }

  if (isHospitalitySpecialistRole(staffRole)) {
    return withHelpAndProfile(
      [
        {
          label: "Hospitality",
          items: [
            {
              href: "/dashboard/hospitality",
              label: "Hospitality Dashboard",
              match: (p) => p === "/dashboard/hospitality",
            },
            {
              href: "/dashboard/hospitality/intakes",
              label: "Intake Calls",
              match: (p) => p.startsWith("/dashboard/hospitality/intakes"),
            },
            {
              href: "/dashboard/hospitality/check-ins",
              label: "Weekly Check-ins",
              match: (p) => p.startsWith("/dashboard/hospitality/check-ins"),
            },
            {
              href: "/dashboard/hospitality/partner-check-ins",
              label: "Partner Check-ins",
              match: (p) => p.startsWith("/dashboard/hospitality/partner-check-ins"),
            },
            communityPartnersNav,
            timeClockNav,
          ],
        },
      ],
      staffRole
    );
  }

  if (isWrtAdminRole(staffRole)) {
    return withHelpAndProfile(
      [
        {
          label: "WRT",
          items: [
            {
              href: "/dashboard/wrt",
              label: "WRT Facilitation",
              match: (p) => p === "/dashboard/wrt",
            },
            {
              href: "/dashboard/wrt/curriculum",
              label: "WRT Curriculum",
              match: (p) => p.startsWith("/dashboard/wrt/curriculum"),
            },
            timeClockNav,
          ],
        },
        {
          label: "Reference",
          items: [communityPartnersNav],
        },
      ],
      staffRole
    );
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
            timeClockNav,
            {
              href: "/dashboard/timesheet",
              label: "My Time (Timesheet)",
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

  return withHelpAndProfile(
    [
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
    ],
    staffRole
  );
}

export function staffNavBadge(role: string | null | undefined): WayfinderNavBadge {
  if (isSuperAdminRole(role)) return "Super Admin";
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
    isEsRole(r) ||
    r === "supervisor" ||
    r === "admin" ||
    r === "super_admin" ||
    r === "counselor" ||
    r === "accountant" ||
    r === "hr" ||
    r === "hospitality_specialist"
  );
}

export function staffWorkspaceLabel(staffRole: string | null): string {
  if (isCounselorRole(staffRole)) return "Counselor Workspace";
  if (isSuperAdminRole(staffRole)) return "Super Admin";
  if (isAdminTierRole(staffRole)) return "Admin Workspace";
  if (isSupervisorRole(staffRole)) return "Supervisor Workspace";
  if (isEsRole(staffRole)) return "Employment Specialist";
  if (staffRole === "accountant") return "Accounts Specialist";
  if (isHrRole(staffRole)) return "HR Workspace";
  if (isHospitalitySpecialistRole(staffRole)) return "Hospitality Workspace";
  return "Team Member Workspace";
}
