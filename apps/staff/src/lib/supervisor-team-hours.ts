import {
  shiftWeekStart,
  summarizeTimeEntries,
} from "@/lib/es-time-client";
import {
  loadEsTimeEntriesForWeek,
  loadStaffClockMinutesForWeek,
  loadSupervisedEsOptions,
} from "@/lib/es-time-data";
import { weekEndSaturday, weekStartSunday } from "@wayfinder/supabase/es-time-tracking";
import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

export type SupervisorTeamHoursWeek = {
  weekStart: string;
  weekEnd: string;
  billableMinutes: number;
  workedMinutes: number;
  workedFromClock: boolean;
};

export type SupervisorTeamHoursRow = {
  esUserId: string;
  esName: string;
  currentWeek: SupervisorTeamHoursWeek;
  previousWeek: SupervisorTeamHoursWeek;
};

async function summarizeWeek(
  admin: AdminClient,
  esUserId: string,
  weekStart: string
): Promise<SupervisorTeamHoursWeek> {
  const weekEnd = weekEndSaturday(weekStart);
  const [entries, clockMinutes] = await Promise.all([
    loadEsTimeEntriesForWeek(admin, esUserId, weekStart),
    loadStaffClockMinutesForWeek(admin, esUserId, weekStart),
  ]);
  const summary = summarizeTimeEntries(entries);
  const workedFromClock = clockMinutes > 0;
  return {
    weekStart,
    weekEnd,
    billableMinutes: summary.billableMinutes,
    workedMinutes: workedFromClock ? clockMinutes : summary.workedMinutes,
    workedFromClock,
  };
}

/** Hours for each supervised ES: current Sun–Sat week and the prior week. */
export async function loadSupervisorTeamHours(
  admin: AdminClient,
  supervisorUserId: string
): Promise<SupervisorTeamHoursRow[]> {
  const esOptions = await loadSupervisedEsOptions(admin, supervisorUserId);
  if (esOptions.length === 0) {
    return [];
  }

  const currentWeekStart = weekStartSunday(new Date());
  const previousWeekStart = shiftWeekStart(currentWeekStart, -1);

  return Promise.all(
    esOptions.map(async (es) => {
      const [currentWeek, previousWeek] = await Promise.all([
        summarizeWeek(admin, es.id, currentWeekStart),
        summarizeWeek(admin, es.id, previousWeekStart),
      ]);
      return {
        esUserId: es.id,
        esName: es.name,
        currentWeek,
        previousWeek,
      };
    })
  );
}
