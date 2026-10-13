import { weekEndSaturday, weekStartSunday } from "@wayfinder/supabase/es-time-tracking";
import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  isAdminTierRole,
  isFieldSpecialistRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import {
  loadEsCaseloadClientOptions,
  loadEsTimeEntriesForWeek,
  loadPendingWeekSubmissionsForSupervisor,
  loadStaffClockMinutesForWeek,
  loadStaffEsPickerOptions,
  loadWeekSubmission,
} from "@/lib/es-time-data";
import { loadStaffNameById } from "@/lib/operations-data";
import { esUserAllowedForSupervisor, loadSupervisorScope } from "@/lib/supervisor-client-scope";
import type { EsTimeEntryRow, EsWeekSubmissionRow, SupervisedEsOption, TimesheetClientOption } from "@/lib/es-time-client";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

export type TimesheetSectionSearchParams = {
  week?: string;
  es?: string;
  client?: string;
};

export type TimesheetWorkspaceServerProps = {
  role: string;
  esUserId: string;
  esName: string;
  weekStart: string;
  weekEnd: string;
  entries: EsTimeEntryRow[];
  weekSubmission: EsWeekSubmissionRow | null;
  pendingApprovals: EsWeekSubmissionRow[];
  readOnly: boolean;
  supervisedEsOptions: SupervisedEsOption[];
  caseloadClients: TimesheetClientOption[];
  initialClientFilter: string;
  canPickEs: boolean;
  payrollClockMinutes: number | null;
  basePath: string;
};

export type TimesheetSectionLoadResult =
  | { kind: "hidden" }
  | { kind: "redirect"; url: string }
  | { kind: "ready"; props: TimesheetWorkspaceServerProps };

export const BILLABLE_HOURS_TIMESHEET_PATH = "/dashboard/billable-hours";

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
  return `${basePath}${qs ? `?${qs}` : ""}#weekly-timesheet`;
}

/** Shared loader for weekly timesheet UI on Billable Hours (legacy /timesheet redirects here). */
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

  const weekStart = weekStartSunday(params.week ?? new Date());
  const weekEnd = weekEndSaturday(weekStart);

  const canPickEs =
    isSupervisorRole(role) ||
    isAdminTierRole(role) ||
    role === "accountant" ||
    role === "hr";

  const useOrgPayrollClock =
    (role === "accountant" || role === "hr" || isAdminTierRole(role)) &&
    canPickEs &&
    !isFieldSpecialistRole(role);

  const esPickerOptions =
    canPickEs && !isFieldSpecialistRole(role)
      ? await loadStaffEsPickerOptions(admin, role ?? "", effectiveUserId)
      : [];

  let esUserId = effectiveUserId;

  if (canPickEs && !isFieldSpecialistRole(role)) {
    if (params.es) {
      const allowed = esPickerOptions.some((opt) => opt.id === params.es);
      if (!allowed) {
        const qs = new URLSearchParams({ week: weekStart });
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
      const qs = new URLSearchParams({ es: esPickerOptions[0]!.id, week: weekStart });
      if (params.client) {
        qs.set("client", params.client);
      }
      return { kind: "redirect", url: timesheetUrl(basePath, qs) };
    }
  }

  if (isSupervisorRole(role) && !isAdminTierRole(role) && params.es) {
    const scope = await loadSupervisorScope(admin, effectiveUserId);
    if (!esUserAllowedForSupervisor(scope, esUserId)) {
      const qs = new URLSearchParams({ week: weekStart });
      return { kind: "redirect", url: timesheetUrl(basePath, qs) };
    }
  }

  const [esNames, entries, weekSubmission, pendingApprovals, caseloadClients, clockPayrollMinutes] =
    await Promise.all([
      loadStaffNameById(admin, [esUserId], "Team member"),
      loadEsTimeEntriesForWeek(admin, esUserId, weekStart),
      loadWeekSubmission(admin, esUserId, weekStart),
      isSupervisorRole(role) || isAdminTierRole(role)
        ? loadPendingWeekSubmissionsForSupervisor(admin, effectiveUserId)
        : Promise.resolve([]),
      canPickEs && !isFieldSpecialistRole(role)
        ? loadEsCaseloadClientOptions(admin, esUserId)
        : Promise.resolve([]),
      useOrgPayrollClock
        ? loadStaffClockMinutesForWeek(admin, esUserId, weekStart)
        : Promise.resolve(null as number | null),
    ]);

  const esName = esNames.get(esUserId) ?? "Team member";

  return {
    kind: "ready",
    props: {
      role: role ?? "",
      esUserId,
      esName,
      weekStart,
      weekEnd,
      entries,
      weekSubmission,
      pendingApprovals,
      readOnly: isPreviewing,
      supervisedEsOptions: esPickerOptions,
      caseloadClients,
      initialClientFilter: params.client ?? "",
      canPickEs: canPickEs && !isFieldSpecialistRole(role),
      payrollClockMinutes: clockPayrollMinutes,
      basePath,
    },
  };
}
