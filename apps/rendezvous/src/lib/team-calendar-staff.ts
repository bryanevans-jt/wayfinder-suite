/**
 * Team Calendar staff directory for the people picker.
 *
 * The picker lists every allow-listed staff member (schedules optional) so
 * admins/supervisors see the full visible team even when someone has no
 * Rendezvous schedule or bookings in range.
 */

export type TeamCalendarStaffMember = {
  id: string;
  name: string;
};

export type TeamCalendarScheduleRow = {
  staff_user_id: string;
  display_name?: string | null;
};

/**
 * Build the people-picker list from the visibility allow-list.
 * Prefer schedule display_name, then booking staffName, then profile full_name, then "Staff".
 * Only IDs in `visibleStaffUserIds` are included — and every allow-listed ID appears.
 */
export function buildTeamCalendarStaffDirectory(opts: {
  /** Explicit allow-list from server visibility rules. */
  visibleStaffUserIds: string[];
  schedules: TeamCalendarScheduleRow[];
  /** Optional names learned from bookings in range. */
  bookingStaffNames?: Map<string, string> | Record<string, string>;
  /** Optional profile full names keyed by user id. */
  profileNames?: Map<string, string> | Record<string, string>;
}): TeamCalendarStaffMember[] {
  const allowed = Array.from(
    new Set(opts.visibleStaffUserIds.filter(Boolean))
  );
  const allowedSet = new Set(allowed);
  const bookingNames = toMap(opts.bookingStaffNames);
  const profileNames = toMap(opts.profileNames);

  const scheduleName = new Map<string, string>();
  for (const schedule of opts.schedules) {
    const id = schedule.staff_user_id;
    if (!id || !allowedSet.has(id)) continue;
    const label = (schedule.display_name ?? "").trim();
    if (label) scheduleName.set(id, label);
  }

  const staff: TeamCalendarStaffMember[] = [];
  for (const id of allowed) {
    const name =
      scheduleName.get(id) ||
      bookingNames.get(id)?.trim() ||
      profileNames.get(id)?.trim() ||
      "Staff";
    staff.push({ id, name });
  }

  staff.sort((a, b) => a.name.localeCompare(b.name));
  return staff;
}

/**
 * People IDs the UI should offer as checkboxes.
 * Uses the staff directory when present; falls back to booking/event-derived IDs.
 */
export function resolveTeamCalendarPeoplePickerIds(opts: {
  staff: TeamCalendarStaffMember[];
  bookingStaffUserIds: string[];
}): string[] {
  if (opts.staff.length > 0) {
    return opts.staff.map((s) => s.id);
  }
  return Array.from(new Set(opts.bookingStaffUserIds.filter(Boolean)));
}

function toMap(
  input?: Map<string, string> | Record<string, string>
): Map<string, string> {
  if (!input) return new Map();
  if (input instanceof Map) return input;
  return new Map(Object.entries(input));
}
