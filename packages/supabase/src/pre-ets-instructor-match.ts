import type { SupabaseClient } from "@supabase/supabase-js";

/** Strip worksheet suffixes like "(Muscogee County)" before staff lookup. */
export function normalizeInstructorNameForLookup(name: string): string {
  return name
    .trim()
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const PRE_ETS_INSTRUCTOR_ROLES = ["transition_specialist", "instructor"] as const;

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase();
}

async function resolveInstructorProfile(
  admin: SupabaseClient,
  rawLabel: string
): Promise<{ userId: string | null; displayName: string | null }> {
  const label = normalizeInstructorNameForLookup(rawLabel);
  if (!label) return { userId: null, displayName: null };

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("is_active", true)
    .in("role", [...PRE_ETS_INSTRUCTOR_ROLES]);

  const target = normalizeLookup(label);
  const exact = (profiles ?? []).filter(
    (p) => normalizeLookup(String(p.full_name ?? "")) === target
  );
  const pick =
    exact[0] ??
    (profiles ?? []).find((p) => normalizeLookup(String(p.full_name ?? "")).includes(target));

  if (pick && PRE_ETS_INSTRUCTOR_ROLES.includes(pick.role as (typeof PRE_ETS_INSTRUCTOR_ROLES)[number])) {
    return {
      userId: pick.id as string,
      displayName: (pick.full_name as string | null) ?? label,
    };
  }

  return { userId: null, displayName: label };
}

/** Match worksheet instructor (often ALL CAPS) to Transition Specialist / Instructor profiles. */
export async function assignPreEtsPrimaryInstructorFromWorksheet(
  admin: SupabaseClient,
  input: {
    schoolId: string;
    programGroupId: string;
    instructorName: string | null | undefined;
  }
): Promise<{ matched: boolean; userId: string | null }> {
  const raw = input.instructorName?.trim();
  if (!raw) return { matched: false, userId: null };

  const { userId, displayName } = await resolveInstructorProfile(admin, raw);
  if (!userId) return { matched: false, userId: null };

  await admin.from("pre_ets_staff_school_assignments").upsert(
    {
      school_id: input.schoolId,
      user_id: userId,
      assignment_role: "primary",
    },
    { onConflict: "school_id,user_id,assignment_role" }
  );

  if (displayName && normalizeLookup(displayName) !== normalizeLookup(raw)) {
    await admin
      .from("pre_ets_program_groups")
      .update({ instructor_name: displayName })
      .eq("id", input.programGroupId);
  }

  return { matched: true, userId };
}
