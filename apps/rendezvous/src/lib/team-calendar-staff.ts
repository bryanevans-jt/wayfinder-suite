/**
 * Team Calendar staff directory for the people picker.
 *
 * The picker must not depend on bookings existing in the selected range —
 * otherwise admins/supervisors only see themselves when they are the only
 * person with a confirmed booking (production had that exact case).
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
 * Build the people-picker list from visible schedules (+ optional booking/profile names).
 * Prefer schedule display_name, then booking staffName, then profile full_name, then "Staff".
 * Only IDs in `visibleStaffUserIds` are included.
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
  const allowed = new Set(opts.visibleStaffUserIds.filter(Boolean));
  const bookingNames = toMap(opts.bookingStaffNames);
  const profileNames = toMap(opts.profileNames);

  const ids = new Set<string>();
  for (const schedule of opts.schedules) {
    const id = schedule.staff_user_id;
    if (id && allowed.has(id)) ids.add(id);
  }
  for (const id of bookingNames.keys()) {
    if (allowed.has(id)) ids.add(id);
  }

  const scheduleName = new Map<string, string>();
  for (const schedule of opts.schedules) {
    const id = schedule.staff_user_id;
    if (!id || !allowed.has(id)) continue;
    const label = (schedule.display_name ?? "").trim();
    if (label) scheduleName.set(id, label);
  }

  const staff: TeamCalendarStaffMember[] = [];
  for (const id of ids) {
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
 * Uses the staff directory when present; falls back to booking-derived IDs.
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
