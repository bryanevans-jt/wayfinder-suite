import type { PortalNavState, PortalSettingsSubNav } from "@/components/portal-nav";

const SETTINGS_KEYS = new Set<string>([
  "users",
  "advanced",
  "errors",
  "pto",
  "wrt",
  "payroll",
  "demos",
  "referrals",
  "pre_ets",
  "ijp_billing",
  "features",
  "services",
  "emails",
]);

/** Deep-link Super Admin / Admin portal tabs, e.g. ?tab=settings&settings=ijp_billing */
export function portalNavFromSearchParams(
  params: Record<string, string | string[] | undefined> | undefined
): PortalNavState | null {
  if (!params) return null;

  const tab = pickParam(params.tab);
  if (tab === "settings") {
    const settings = pickParam(params.settings);
    if (settings && SETTINGS_KEYS.has(settings)) {
      return { primary: "settings", settings: settings as PortalSettingsSubNav };
    }
    return { primary: "settings", settings: "users" };
  }
  if (tab === "team") {
    const team = pickParam(params.team);
    return { primary: "team", team: team === "supervisors" ? "supervisors" : "es" };
  }
  if (tab === "offices") {
    const offices = pickParam(params.offices);
    if (offices === "counselors" || offices === "gvra_supervisors") {
      return { primary: "offices", offices };
    }
    return { primary: "offices", offices: "directory" };
  }
  if (tab === "reports") {
    const reports = pickParam(params.reports);
    return { primary: "reports", reports: reports === "messages" ? "messages" : "activity" };
  }
  if (tab === "clients" || tab === "connections") {
    return { primary: tab };
  }
  return null;
}

function pickParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
