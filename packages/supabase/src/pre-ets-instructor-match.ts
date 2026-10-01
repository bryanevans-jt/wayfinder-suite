import type { SupabaseClient } from "@supabase/supabase-js";

/** Strip worksheet suffixes like "(Muscogee County)" before staff lookup. */
export function normalizeInstructorNameForLookup(name: string): string {
  return name
    .trim()
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const PRE_ETS_WORKSHEET_INSTRUCTOR_ROLES = [
  "transition_specialist",
  "instructor",
] as const;

export const PRE_ETS_CLASS_SETUP_TS_ROLES = [
  "transition_specialist",
  "instructor",
  "es",
] as const;

const MIN_NAME_MATCH_SCORE = 72;

function normalizePersonNameKey(name: string): string {
  let base = normalizeInstructorNameForLookup(name).toLowerCase().trim();
  if (base.includes(",")) {
    base = flipCommaName(base);
  }
  return base.replace(/[.,']/g, "").replace(/\s+/g, " ").trim();
}

function flipCommaName(key: string): string {
  const match = key.match(/^(.+),\s*(.+)$/);
  if (!match) return key;
  return `${match[2]?.trim() ?? ""} ${match[1]?.trim() ?? ""}`.trim();
}

function nameTokens(key: string): string[] {
  return key.split(" ").filter(Boolean);
}

/** Higher = better; 0 = no match. */
export function scorePreEtsPersonNameMatch(targetRaw: string, candidateRaw: string): number {
  const target = normalizePersonNameKey(targetRaw);
  const candidate = normalizePersonNameKey(candidateRaw);
  if (!target || !candidate) return 0;
  if (target === candidate) return 100;

  const targetFlipped = target.includes(",") ? flipCommaName(target) : target;
  const candidateFlipped = candidate.includes(",") ? flipCommaName(candidate) : candidate;
  if (targetFlipped === candidateFlipped) return 98;

  if (candidate.includes(target) || target.includes(candidate)) return 85;

  const tTokens = nameTokens(targetFlipped);
  const cTokens = nameTokens(candidateFlipped);
  if (tTokens.length >= 2 && cTokens.length >= 2) {
    const tFirst = tTokens[0] ?? "";
    const tLast = tTokens[tTokens.length - 1] ?? "";
    const cFirst = cTokens[0] ?? "";
    const cLast = cTokens[cTokens.length - 1] ?? "";
    if (tLast === cLast && tFirst === cFirst) return 95;
    if (
      tLast === cLast &&
      (cFirst.startsWith(tFirst) || tFirst.startsWith(cFirst) || tFirst[0] === cFirst[0])
    ) {
      return 88;
    }
    if (
      tTokens.every((t) =>
        cTokens.some((c) => c === t || c.startsWith(t) || t.startsWith(c))
      )
    ) {
      return 80;
    }
    if (tLast === cLast) return 78;
  }

  if (tTokens.length === 1 && cTokens.some((c) => c === tTokens[0] || c.startsWith(tTokens[0]!))) {
    return 70;
  }

  return 0;
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean | null;
};

async function loadActiveProfilesForRoles(
  admin: SupabaseClient,
  roles: readonly string[]
): Promise<ProfileRow[]> {
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("is_active", true)
    .in("role", [...roles]);

  return (profiles ?? []) as ProfileRow[];
}

async function resolveByEmail(
  admin: SupabaseClient,
  email: string,
  roles: readonly string[]
): Promise<{ userId: string | null; displayName: string | null }> {
  const normalizedEmail = email.trim().toLowerCase();
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const match = users.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
  if (!match) return { userId: null, displayName: null };

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", match.id)
    .maybeSingle();

  if (!profile || profile.is_active === false || !roles.includes(String(profile.role ?? ""))) {
    return { userId: null, displayName: null };
  }

  return {
    userId: profile.id as string,
    displayName: (profile.full_name as string | null) ?? normalizedEmail,
  };
}

/**
 * Match a spreadsheet / setup display name to an active profile (Transition Specialist, Instructor, etc.).
 */
export async function resolvePreEtsStaffProfileByName(
  admin: SupabaseClient,
  label: string | null | undefined,
  roles: readonly string[]
): Promise<{ userId: string | null; displayName: string | null; matchScore: number }> {
  const raw = normalizeInstructorNameForLookup(label ?? "");
  if (!raw) return { userId: null, displayName: null, matchScore: 0 };

  if (raw.includes("@")) {
    const byEmail = await resolveByEmail(admin, raw, roles);
    return { ...byEmail, matchScore: byEmail.userId ? 100 : 0 };
  }

  const profiles = await loadActiveProfilesForRoles(admin, roles);
  let best: ProfileRow | null = null;
  let bestScore = 0;

  for (const profile of profiles) {
    const fullName = String(profile.full_name ?? "").trim();
    if (!fullName) continue;
    const score = scorePreEtsPersonNameMatch(raw, fullName);
    if (score > bestScore) {
      bestScore = score;
      best = profile;
    }
  }

  if (best && bestScore >= MIN_NAME_MATCH_SCORE && roles.includes(String(best.role ?? ""))) {
    return {
      userId: best.id as string,
      displayName: (best.full_name as string | null) ?? raw,
      matchScore: bestScore,
    };
  }

  return { userId: null, displayName: raw, matchScore: 0 };
}

export async function upsertPreEtsPrimarySchoolAssignment(
  admin: SupabaseClient,
  input: { schoolId: string; userId: string }
): Promise<void> {
  await admin.from("pre_ets_staff_school_assignments").upsert(
    {
      school_id: input.schoolId,
      user_id: input.userId,
      assignment_role: "primary",
    },
    { onConflict: "school_id,user_id,assignment_role" }
  );
}

/** One primary Transition Specialist / Instructor per school — spreadsheet is source of truth. */
export async function replacePreEtsPrimaryInstructorForSchool(
  admin: SupabaseClient,
  input: { schoolId: string; userId: string }
): Promise<void> {
  await admin
    .from("pre_ets_staff_school_assignments")
    .delete()
    .eq("school_id", input.schoolId)
    .eq("assignment_role", "primary");

  await upsertPreEtsPrimarySchoolAssignment(admin, input);
}

/** Match worksheet instructor (often ALL CAPS) to Transition Specialist / Instructor profiles. */
export async function assignPreEtsPrimaryInstructorFromWorksheet(
  admin: SupabaseClient,
  input: {
    schoolId: string;
    programGroupId: string;
    instructorName: string | null | undefined;
  }
): Promise<{ matched: boolean; userId: string | null; displayName: string | null }> {
  const raw = input.instructorName?.trim();
  if (!raw) return { matched: false, userId: null, displayName: null };

  const { userId, displayName, matchScore } = await resolvePreEtsStaffProfileByName(
    admin,
    raw,
    PRE_ETS_WORKSHEET_INSTRUCTOR_ROLES
  );

  if (!userId) {
    return { matched: false, userId: null, displayName: displayName ?? raw };
  }

  await replacePreEtsPrimaryInstructorForSchool(admin, {
    schoolId: input.schoolId,
    userId,
  });

  const canonicalName = displayName ?? raw;
  await admin
    .from("pre_ets_program_groups")
    .update({ instructor_name: canonicalName })
    .eq("id", input.programGroupId);

  return { matched: true, userId, displayName: canonicalName };
}
