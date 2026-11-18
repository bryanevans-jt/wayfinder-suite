import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  isAdminTierRole,
  isFieldSpecialistRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import {
  calendarMonthBoundsFromKey,
  currentMonthKey,
  loadEsCaseloadClientOptions,
  loadEsTimeEntriesForMonth,
  loadStaffEsPickerOptions,
  monthLabelFromKey,
} from "@/lib/es-time-data";
import { loadStaffNameById } from "@/lib/operations-data";
import { esUserAllowedForSupervisor, loadSupervisorScope } from "@/lib/supervisor-client-scope";
import type { EsTimeEntryRow, SupervisedEsOption, TimesheetClientOption } from "@/lib/es-time-client";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

export type TimesheetSectionSearchParams = {
  month?: string;
  /** @deprecated Prefer month — kept so old week links still resolve. */
  week?: string;
  es?: string;
  client?: string;
};

export type TimesheetWorkspaceServerProps = {
  role: string;
  esUserId: string;
  esName: string;
  monthKey: string;
  monthStart: string;
  monthEnd: string;
  monthLabel: string;
  entries: EsTimeEntryRow[];
  readOnly: boolean;
  supervisedEsOptions: SupervisedEsOption[];
  caseloadClients: TimesheetClientOption[];
  initialClientFilter: string;
  canPickEs: boolean;
  basePath: string;
};

export type TimesheetSectionLoadResult =
  | { kind: "hidden" }
  | { kind: "redirect"; url: string }
  | { kind: "ready"; props: TimesheetWorkspaceServerProps };

export const BILLABLE_HOURS_TIMESHEET_PATH = "/dashboard/billable-hours";

const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function canAccessWeeklyTimesheetSection(role: string | null | undefined): boolean {
  return (
    isFieldSpecialistRole(role) ||
    isSupervisorRole(role) ||
    role === "accountant" ||
    role === "hr" ||
    isAdminTierRole(role)
  );
}

function timesheetUrl(basePath: string, params: URLSearchParams): string {
  const qs = params.toString();
  return `${basePath}${qs ? `?${qs}` : ""}#monthly-timesheet`;
}

function resolveMonthKey(params: TimesheetSectionSearchParams): string {
  const raw = params.month?.trim() ?? "";
  if (MONTH_KEY_RE.test(raw)) {
    return raw;
  }
  // Legacy week deep-links → month containing that week start.
  if (params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week)) {
    return params.week.slice(0, 7);
  }
  return currentMonthKey();
}

/** Shared loader for monthly timesheet UI on Billable Hours. */
export async function loadTimesheetSection(
  admin: AdminClient,
  opts: {
    role: string;
    effectiveUserId: string;
    isPreviewing: boolean;
    params: TimesheetSectionSearchParams;
    basePath?: string;
  }
): Promise<TimesheetSectionLoadResult> {
  const { role, effectiveUserId, isPreviewing, params } = opts;
  const basePath = opts.basePath ?? BILLABLE_HOURS_TIMESHEET_PATH;

  if (!canAccessWeeklyTimesheetSection(role)) {
    return { kind: "hidden" };
  }

  const monthKey = resolveMonthKey(params);
  const { start: monthStart, end: monthEnd } = calendarMonthBoundsFromKey(monthKey);
  const monthLabel = monthLabelFromKey(monthKey);

  const canPickEs =
    isSupervisorRole(role) ||
    isAdminTierRole(role) ||
    role === "accountant" ||
    role === "hr";

  const esPickerOptions =
    canPickEs && !isFieldSpecialistRole(role)
      ? await loadStaffEsPickerOptions(admin, role ?? "", effectiveUserId)
      : [];

  let esUserId = effectiveUserId;

  if (canPickEs && !isFieldSpecialistRole(role)) {
    if (params.es) {
      const allowed = esPickerOptions.some((opt) => opt.id === params.es);
      if (!allowed) {
        const qs = new URLSearchParams({ month: monthKey });
        if (esPickerOptions[0]) {
          qs.set("es", esPickerOptions[0].id);
        }
        if (params.client) {
          qs.set("client", params.client);
        }
        return { kind: "redirect", url: timesheetUrl(basePath, qs) };
      }
      esUserId = params.es;
    } else if (esPickerOptions.length > 0) {
      const qs = new URLSearchParams({ es: esPickerOptions[0]!.id, month: monthKey });
      if (params.client) {
        qs.set("client", params.client);
      }
      return { kind: "redirect", url: timesheetUrl(basePath, qs) };
    }
  }

  if (isSupervisorRole(role) && !isAdminTierRole(role) && params.es) {
    const scope = await loadSupervisorScope(admin, effectiveUserId);
    if (!esUserAllowedForSupervisor(scope, esUserId)) {
      const qs = new URLSearchParams({ month: monthKey });
      return { kind: "redirect", url: timesheetUrl(basePath, qs) };
    }
  }

  const [esNames, entries, caseloadClients] = await Promise.all([
    loadStaffNameById(admin, [esUserId], "Team member"),
    loadEsTimeEntriesForMonth(admin, esUserId, monthKey),
    canPickEs && !isFieldSpecialistRole(role)
      ? loadEsCaseloadClientOptions(admin, esUserId)
      : Promise.resolve([]),
  ]);

  const esName = esNames.get(esUserId) ?? "Team member";

  return {
    kind: "ready",
    props: {
      role: role ?? "",
      esUserId,
      esName,
      monthKey,
      monthStart,
      monthEnd,
      monthLabel,
      entries,
      readOnly: isPreviewing,
      supervisedEsOptions: esPickerOptions,
      caseloadClients,
      initialClientFilter: params.client ?? "",
      canPickEs: canPickEs && !isFieldSpecialistRole(role),
      basePath,
    },
  };
}
