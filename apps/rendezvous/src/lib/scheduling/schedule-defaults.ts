import {
  canEditOwnStaffProfile,
  isClientRole,
  isCounselorRole,
  isGvraPartnerRole,
  isSupportRole,
} from "@wayfinder/supabase/roles";
import { isValidSlug, slugifyName } from "./slug";

export const DEFAULT_MEETING_LENGTH_MINUTES = 60;
export const DEFAULT_BUFFER_MINUTES = 0;
export const DEFAULT_MIN_NOTICE_HOURS = 24;
export const DEFAULT_BOOKING_WINDOW_DAYS = 14;
export const DEFAULT_WEEKLY_START = "09:00";
export const DEFAULT_WEEKLY_END = "17:00";

/** Mon–Fri (JS day_of_week 1–5). */
export const DEFAULT_WEEKLY_HOURS = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: DEFAULT_WEEKLY_START,
  endTime: DEFAULT_WEEKLY_END,
}));

export type TeamMemberProfile = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
};

/** Joshua Tree team only — no counselors, clients, or natural supports. */
export function isRendezvousTeamMemberRole(role: string | null | undefined): boolean {
  if (isCounselorRole(role) || isClientRole(role) || isSupportRole(role) || isGvraPartnerRole(role)) {
    return false;
  }
  return canEditOwnStaffProfile(role);
}

export function slugFromPersonName(opts: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}): string {
  const first = (opts.firstName ?? "").trim();
  const last = (opts.lastName ?? "").trim();
  if (first && last) {
    const slug = slugifyName(`${first} ${last}`);
    if (slug) return slug;
  }
  const fromFull = slugifyName(opts.fullName ?? "");
  if (fromFull) return fromFull;
  return "team-member";
}

export function allocateUniqueSlug(base: string, taken: Set<string>): string {
  const normalized = isValidSlug(base) ? base : slugifyName(base) || "team-member";
  if (!taken.has(normalized)) {
    taken.add(normalized);
    return normalized;
  }
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${normalized.slice(0, Math.max(1, 64 - String(n).length - 1))}-${n}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  const fallback = `${normalized.slice(0, 55)}-${Date.now().toString(36)}`;
  taken.add(fallback);
  return fallback;
}

export function displayNameForMember(member: TeamMemberProfile): string {
  const composed = [member.first_name, member.last_name]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return composed || member.full_name?.trim() || "Team Member";
}
