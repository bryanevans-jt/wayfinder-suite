import {
  canAccessFormalReporting,
  canEditOwnStaffProfile,
  isAdminTierRole,
  isCounselorRole,
  isEsRole,
  isFieldSpecialistRole,
  isHospitalitySpecialistRole,
  isHrRole,
  isInstructorRole,
  isSuperAdminRole,
  isSupervisorRole,
  isSupervisorTierRole,
  isTransitionSpecialistRole,
  isWrtAdminRole,
  staffHomePath,
} from "@wayfinder/supabase/roles";
import { buildReportsAppUrl } from "@wayfinder/branding";

export { canAccessFormalReporting };

import type { WayfinderNavBadge } from "@wayfinder/branding";

export const COMMUNITY_PARTNERS_PATH = "/dashboard/community-partners";
export const TEAM_DIRECTORY_PATH = "/dashboard/team";
export const INTAKE_CALLS_PATH = "/dashboard/intake/calls";
export const TRAINING_CENTER_URL = "https://careers.thejoshuatree.org/training";

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
  "/dashboard/pre-ets",
  "/dashboard/team",
  "/dashboard/intake",
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
  /** Open in a new tab (external product or careers site). */
  external?: boolean;
};

export type StaffNavSection = {
  /** Optional group label shown above a nav cluster. */
  label?: string;
  items: StaffNavItem[];
};

export type StaffNavOptions = {
  showCommunityPartners?: boolean;
};

const timeClockNav: StaffNavItem = {
  href: "/dashboard/time-clock",
  label: "Time Clock",
  match: (p) => p.startsWith("/dashboard/time-clock"),
};

const reportingNav: StaffNavItem = {
  href: buildReportsAppUrl("/reports"),
  label: "Submit Reports",
  match: () => false,
  external: true,
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

const teamDirectoryNav: StaffNavItem = {
  href: TEAM_DIRECTORY_PATH,
  label: "Team Directory",
  match: (p) => p.startsWith(TEAM_DIRECTORY_PATH),
};

const trainingCenterNav: StaffNavItem = {
  href: TRAINING_CENTER_URL,
  label: "Training Center",
  match: () => false,
  external: true,
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

const preEtsNav: StaffNavItem = {
  href: "/dashboard/pre-ets",
  label: "Pre-ETS",
  match: (p) => p.startsWith("/dashboard/pre-ets"),
};

const intakeCallsNav: StaffNavItem = {
  href: INTAKE_CALLS_PATH,
  label: "Intake Calls",
  match: (p) =>
    p.startsWith(INTAKE_CALLS_PATH) || p.startsWith("/dashboard/hospitality/intakes"),
};

const referralQueueNav: StaffNavItem = {
  href: "/dashboard/referrals",
  label: "Referral Queue",
  match: (p) => p.startsWith("/dashboard/referrals"),
};

export const PRE_ETS_DASHBOARD_PATH = preEtsNav.href;

const cultureNavSection: StaffNavSection = {
  label: "Our Team",
  items: [teamDirectoryNav, coreFourNav, shareMomentsNav],
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

/** Pre-ETS nav visibility — resolved server-side from pre_ets_settings.enabled_roles. */
export function showPreEtsNavForRole(_staffRole: string | null, showPreEtsNav = false): boolean {
  return showPreEtsNav;
}

function withPreEtsNav(items: StaffNavItem[], showPreEtsNav: boolean): StaffNavItem[] {
  if (!showPreEtsNav || items.some((item) => item.href === PRE_ETS_DASHBOARD_PATH)) {
    return items;
  }
  return [preEtsNav, ...items];
}

function maybePartners(items: StaffNavItem[], show: boolean): StaffNavItem[] {
  if (show) return items;
  return items.filter((i) => i.href !== COMMUNITY_PARTNERS_PATH);
}

function withTraining(items: StaffNavItem[]): StaffNavItem[] {
  if (items.some((i) => i.href === TRAINING_CENTER_URL)) return items;
  return [...items, trainingCenterNav];
}

export function isPreEtsStaffPath(pathname: string): boolean {
  return pathname === PRE_ETS_DASHBOARD_PATH || pathname.startsWith(`${PRE_ETS_DASHBOARD_PATH}/`);
}

/** Sidebar navigation grouped for clarity — daily work first, then oversight tools. */
export function staffNavSectionsForRole(
  staffRole: string | null,
  showAuditLink = false,
  showPreEtsNav = false,
  options: StaffNavOptions = {}
): StaffNavSection[] {
  const showCp = options.showCommunityPartners === true;

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
          items: withTraining(
            maybePartners(
              [
                timeClockNav,
                {
                  href: "/dashboard/wrt",
                  label: "WRT Preview",
                  match: (p) => p.startsWith("/dashboard/wrt"),
                },
                reportingNav,
                referralQueueNav,
                intakeCallsNav,
                intakeBillingNav,
                ...(showPreEtsNav ? [preEtsNav] : []),
                communityPartnersNav,
              ],
              showCp
            )
          ),
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
          items: withTraining(
            maybePartners(
              [
                timeClockNav,
                {
                  href: "/dashboard/wrt",
                  label: "WRT Preview",
                  match: (p) => p.startsWith("/dashboard/wrt"),
                },
                reportingNav,
                referralQueueNav,
                intakeCallsNav,
                intakeBillingNav,
                ...(showPreEtsNav ? [preEtsNav] : []),
                communityPartnersNav,
              ],
              showCp
            )
          ),
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
              label: "Regional Supervisor Portal",
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
          items: withTraining(
            maybePartners(
              withPreEtsNav([dataExportsNav, communityPartnersNav], showPreEtsNav),
              showCp
            )
          ),
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
          items: withPreEtsNav(
            [
              intakeBillingNav,
              {
                href: "/dashboard/timesheet",
                label: "Weekly Timesheet",
                match: (p) => p.startsWith("/dashboard/timesheet"),
              },
              timeClockNav,
              dataExportsNav,
            ],
            showPreEtsNav
          ),
        },
        {
          label: "Reference",
          items: withTraining(maybePartners([communityPartnersNav], showCp)),
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
          items: withPreEtsNav(
            [
              {
                href: "/dashboard/hr",
                label: "HR Dashboard",
                match: (p) => p.startsWith("/dashboard/hr"),
              },
              referralQueueNav,
              intakeCallsNav,
              intakeBillingNav,
              {
                href: "/dashboard/timesheet",
                label: "Weekly Timesheet",
                match: (p) => p.startsWith("/dashboard/timesheet"),
              },
              timeClockNav,
              analyticsNav,
              dataExportsNav,
            ],
            showPreEtsNav
          ),
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
          items: maybePartners(
            [
              {
                href: "/dashboard/hospitality",
                label: "Hospitality Dashboard",
                match: (p) => p === "/dashboard/hospitality",
              },
              intakeCallsNav,
              {
                href: "/dashboard/hospitality/check-ins",
                label: "Weekly Check-ins",
                match: (p) => p.startsWith("/dashboard/hospitality/check-ins"),
              },
              ...(showCp
                ? [
                    {
                      href: "/dashboard/hospitality/partner-check-ins",
                      label: "Partner Check-ins",
                      match: (p: string) =>
                        p.startsWith("/dashboard/hospitality/partner-check-ins"),
                    } satisfies StaffNavItem,
                    communityPartnersNav,
                  ]
                : []),
              timeClockNav,
            ],
            showCp
          ),
        },
      ],
      staffRole
    );
  }

  if (isInstructorRole(staffRole)) {
    return withHelpAndProfile(
      [
        {
          label: "Pre-ETS",
          items: [...(showPreEtsNav ? [preEtsNav] : []), timeClockNav],
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
          items: withTraining(maybePartners([communityPartnersNav], showCp)),
        },
      ],
      staffRole
    );
  }

  // Transition Specialist: ES shell + Pre-ETS (always when enabled for role / settings)
  if (isTransitionSpecialistRole(staffRole)) {
    return withHelpAndProfile(
      [
        {
          label: "Daily Work",
          items: withPreEtsNav(
            [
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
            true
          ),
        },
        {
          label: "Resources",
          items: withTraining(
            maybePartners([communityPartnersNav, analyticsNav, dataExportsNav], showCp)
          ),
        },
      ],
      staffRole
    );
  }

  // Employment Specialist — no Pre-ETS
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
          items: withTraining(
            maybePartners([communityPartnersNav, analyticsNav, dataExportsNav], showCp)
          ),
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
    isFieldSpecialistRole(r) ||
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
  if (isSupervisorRole(staffRole)) return "Regional Supervisor Workspace";
  if (isTransitionSpecialistRole(staffRole)) return "Transition Specialist";
  if (isEsRole(staffRole)) return "Employment Specialist";
  if (staffRole === "accountant") return "Accounts Specialist";
  if (isHrRole(staffRole)) return "HR Director Workspace";
  if (isHospitalitySpecialistRole(staffRole)) return "Hospitality Workspace";
  return "Team Member Workspace";
}
