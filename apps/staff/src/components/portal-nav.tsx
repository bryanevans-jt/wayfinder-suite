"use client";

export type PortalPrimaryNav =
  | "clients"
  | "team"
  | "offices"
  | "reports"
  | "settings"
  | "connections";

export type PortalTeamSubNav = "es" | "supervisors";
export type PortalOfficesSubNav = "directory" | "counselors";
export type PortalReportsSubNav = "activity" | "messages";
export type PortalSettingsSubNav = "users" | "advanced" | "errors";

export type PortalNavState = {
  primary: PortalPrimaryNav;
  team?: PortalTeamSubNav;
  offices?: PortalOfficesSubNav;
  reports?: PortalReportsSubNav;
  settings?: PortalSettingsSubNav;
};

type PortalMode = "super_admin" | "admin" | "supervisor";

const PRIMARY_LABELS: Record<PortalPrimaryNav, string> = {
  clients: "Clients",
  team: "Team",
  offices: "Offices",
  reports: "Reports",
  settings: "Settings",
  connections: "Connections",
};

const TEAM_LABELS: Record<PortalTeamSubNav, string> = {
  es: "Employment Specialists",
  supervisors: "Supervisors",
};

const OFFICES_LABELS: Record<PortalOfficesSubNav, string> = {
  directory: "Directory",
  counselors: "Counselors",
};

const REPORTS_LABELS: Record<PortalReportsSubNav, string> = {
  activity: "Activity Logs",
  messages: "Message Audit",
};

const SETTINGS_LABELS: Record<PortalSettingsSubNav, string> = {
  users: "Administrators",
  advanced: "Advanced Connections",
  errors: "Error Log",
};

function primaryTabsForMode(mode: PortalMode, canManage: boolean): PortalPrimaryNav[] {
  if (!canManage) {
    return ["clients", "team", "offices", "reports", "connections"];
  }
  return ["clients", "team", "offices", "reports", "settings"];
}

type Props = {
  mode: PortalMode;
  canManage: boolean;
  nav: PortalNavState;
  onChange: (nav: PortalNavState) => void;
};

export function PortalNav({ mode, canManage, nav, onChange }: Props) {
  const primaryTabs = primaryTabsForMode(mode, canManage);

  function selectPrimary(primary: PortalPrimaryNav) {
    if (primary === "team") {
      onChange({ primary, team: nav.team ?? "es" });
      return;
    }
    if (primary === "offices") {
      onChange({ primary, offices: nav.offices ?? "directory" });
      return;
    }
    if (primary === "reports") {
      onChange({ primary, reports: nav.reports ?? "activity" });
      return;
    }
    if (primary === "settings") {
      onChange({ primary, settings: nav.settings ?? "users" });
      return;
    }
    onChange({ primary });
  }

  const teamSubs: PortalTeamSubNav[] = canManage ? ["es", "supervisors"] : ["es"];

  const officesSubs: PortalOfficesSubNav[] = canManage ? ["directory", "counselors"] : [];

  const reportsSubs: PortalReportsSubNav[] = canManage
    ? ["activity", "messages"]
    : ["activity"];

  const settingsSubs: PortalSettingsSubNav[] =
    mode === "super_admin"
      ? ["users", "advanced", "errors"]
      : ["users", "advanced"];

  return (
    <div className="mt-8 space-y-3">
      <nav className="flex flex-wrap gap-2 border-b border-neutral-200 pb-3">
        {primaryTabs.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => selectPrimary(id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              nav.primary === id
                ? "bg-brand-green/10 text-brand-green"
                : "text-brand-black/70 hover:bg-neutral-100"
            }`}
          >
            {PRIMARY_LABELS[id]}
          </button>
        ))}
      </nav>

      {nav.primary === "team" && teamSubs.length > 1 ? (
        <nav className="flex flex-wrap gap-2">
          {teamSubs.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ primary: "team", team: id })}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                (nav.team ?? "es") === id
                  ? "bg-neutral-200 text-brand-black"
                  : "text-brand-black/60 hover:bg-neutral-100"
              }`}
            >
              {TEAM_LABELS[id]}
            </button>
          ))}
        </nav>
      ) : null}

      {nav.primary === "offices" && officesSubs.length > 1 ? (
        <nav className="flex flex-wrap gap-2">
          {officesSubs.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ primary: "offices", offices: id })}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                (nav.offices ?? "directory") === id
                  ? "bg-neutral-200 text-brand-black"
                  : "text-brand-black/60 hover:bg-neutral-100"
              }`}
            >
              {OFFICES_LABELS[id]}
            </button>
          ))}
        </nav>
      ) : null}

      {nav.primary === "reports" && reportsSubs.length > 1 ? (
        <nav className="flex flex-wrap gap-2">
          {reportsSubs.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ primary: "reports", reports: id })}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                (nav.reports ?? "activity") === id
                  ? "bg-neutral-200 text-brand-black"
                  : "text-brand-black/60 hover:bg-neutral-100"
              }`}
            >
              {REPORTS_LABELS[id]}
            </button>
          ))}
        </nav>
      ) : null}

      {nav.primary === "settings" && canManage ? (
        <nav className="flex flex-wrap gap-2">
          {settingsSubs.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ primary: "settings", settings: id })}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                (nav.settings ?? "users") === id
                  ? "bg-neutral-200 text-brand-black"
                  : "text-brand-black/60 hover:bg-neutral-100"
              }`}
            >
              {SETTINGS_LABELS[id]}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

export function isActivityLogsNav(nav: PortalNavState): boolean {
  return nav.primary === "reports" && (nav.reports ?? "activity") === "activity";
}

export function isTeamEsNav(nav: PortalNavState): boolean {
  return nav.primary === "team" && (nav.team ?? "es") === "es";
}

export function isOfficesCounselorsNav(nav: PortalNavState): boolean {
  return nav.primary === "offices" && nav.offices === "counselors";
}

export function isTeamSupervisorsNav(nav: PortalNavState): boolean {
  return nav.primary === "team" && nav.team === "supervisors";
}
