import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyUser } from "./notify-user";
import { canDeliverPreEtsSessions, loadPreEtsSettings } from "./pre-ets-settings";

export async function loadSchoolFieldRecipients(
  admin: SupabaseClient,
  schoolId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("pre_ets_staff_school_assignments")
    .select("user_id, assignment_role, profiles(role, is_active)")
    .eq("school_id", schoolId)
    .in("assignment_role", ["primary", "co_instructor", "supervisor"]);

  if (error) {
    throw new Error(error.message);
  }

  const settings = await loadPreEtsSettings(admin);
  const ids = new Set<string>();

  for (const row of data ?? []) {
    const userId = row.user_id as string;
    const profileRaw = row.profiles as
      | { role: string | null; is_active: boolean | null }
      | { role: string | null; is_active: boolean | null }[]
      | null;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    if (!profile?.is_active) continue;

    const role = profile.role ?? "";
    const assignmentRole = row.assignment_role as string;

    if (assignmentRole === "supervisor") {
      ids.add(userId);
      continue;
    }

    if (
      (assignmentRole === "primary" || assignmentRole === "co_instructor") &&
      canDeliverPreEtsSessions(role, settings)
    ) {
      ids.add(userId);
    }
  }

  return [...ids];
}

export async function notifyPreEtsRosterReleased(
  admin: SupabaseClient,
  input: {
    authorizationId: string;
    schoolId: string;
    schoolLabel: string;
    authNumber: string | null;
    serviceMonth: string;
  }
): Promise<void> {
  const recipientIds = await loadSchoolFieldRecipients(admin, input.schoolId);
  if (recipientIds.length === 0) return;

  const month = input.serviceMonth.slice(0, 7);
  const title = `Roster ready: ${input.schoolLabel}`;
  const authBit = (input.authNumber ?? "").trim();
  const body = authBit
    ? `Authorization ${authBit} is on file. You can schedule sessions and print sign-in rosters in Pre-ETS.`
    : `Next-month roster is available (authorization pending). You can schedule sessions and print sign-in rosters; the A&I number will appear when Accounts adds it.`;
  const link_path = `/dashboard/pre-ets?tab=authorizations&month=${encodeURIComponent(month)}`;

  await Promise.all(
    recipientIds.map((userId) =>
      notifyUser(admin, {
        userId,
        app: "staff",
        kind: "pre_ets_roster_released",
        title,
        body,
        link_path,
        metadata: {
          authorizationId: input.authorizationId,
          schoolId: input.schoolId,
          authNumber: authBit || null,
          serviceMonth: input.serviceMonth,
        },
      })
    )
  );
}

/** Notify field staff that an already-released roster changed (students / service code / auth). */
export async function notifyPreEtsRosterUpdated(
  admin: SupabaseClient,
  input: {
    authorizationId: string;
    schoolId: string;
    schoolLabel: string;
    serviceMonth: string;
    changeSummary: string;
  }
): Promise<void> {
  const recipientIds = await loadSchoolFieldRecipients(admin, input.schoolId);
  if (recipientIds.length === 0) return;

  const month = input.serviceMonth.slice(0, 7);
  const title = `Roster updated: ${input.schoolLabel}`;
  const body = input.changeSummary;
  const link_path = `/dashboard/pre-ets?tab=authorizations&month=${encodeURIComponent(month)}`;

  await Promise.all(
    recipientIds.map((userId) =>
      notifyUser(admin, {
        userId,
        app: "staff",
        kind: "pre_ets_roster_updated",
        title,
        body,
        link_path,
        metadata: {
          authorizationId: input.authorizationId,
          schoolId: input.schoolId,
          serviceMonth: input.serviceMonth,
          changeSummary: input.changeSummary,
        },
      })
    )
  );
}
