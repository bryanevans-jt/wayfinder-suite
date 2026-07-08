import type { SupabaseClient } from "@supabase/supabase-js";

type InsertClientParams = {
  authUserId: string;
  serviceId: string;
  stageId: string;
  officeId: string;
  counselorRowId: string;
  counselorLoginId?: string | null;
  contactEmail: string;
};

function isRetryableClientSchemaError(message: string): boolean {
  return (
    /Could not find the '([^']+)' column/.test(message) ||
    /null value in column "profile_id"/i.test(message) ||
    /null value in column "user_id"/i.test(message) ||
    /foreign key constraint|violates foreign key/i.test(message)
  );
}

export function counselorFkIds(counselor: {
  rowId: string;
  loginId?: string | null;
}): string[] {
  return [
    ...new Set(
      [counselor.rowId, counselor.loginId].filter(
        (v): v is string => typeof v === "string" && v.length > 0
      )
    ),
  ];
}

/** Updates a client row, retrying counselor_id when legacy FK targets auth user id.
 * Pass counselor `null` to clear counselor_id; omit to leave counselor unchanged.
 */
export async function updateClientRecord(
  admin: SupabaseClient,
  clientId: string,
  patch: Record<string, string | null>,
  counselor?: { rowId: string; loginId?: string | null } | null
): Promise<{ ok: true } | { error: string }> {
  const { counselor_id: _ignored, ...withoutCounselor } = patch;
  const basePatch =
    counselor !== undefined ? withoutCounselor : patch;

  if (counselor === undefined) {
    if (Object.keys(basePatch).length === 0) {
      return { ok: true };
    }
    const { error } = await admin.from("clients").update(basePatch).eq("id", clientId);
    if (error) return { error: error.message };
    return { ok: true };
  }

  if (counselor === null) {
    const attempt = { ...basePatch, counselor_id: null };
    const { error } = await admin.from("clients").update(attempt).eq("id", clientId);
    if (error) return { error: error.message };
    return { ok: true };
  }

  const counselorIds = counselorFkIds(counselor);
  if (counselorIds.length === 0) {
    return { error: "counselor_id cannot be empty" };
  }

  let lastMessage = "Could not update client record";

  for (const counselorId of counselorIds) {
    const attempt = { ...basePatch, counselor_id: counselorId };
    if (Object.keys(attempt).length === 0) {
      continue;
    }
    const { error } = await admin.from("clients").update(attempt).eq("id", clientId);
    if (!error) {
      return { ok: true };
    }
    lastMessage = error.message;
    if (!isRetryableClientSchemaError(error.message)) {
      return { error: lastMessage };
    }
  }

  return { error: lastMessage };
}

/** Inserts a client row across legacy (profile_id) and Wayfinder (user_id) schemas. */
export async function insertClientRecord(
  admin: SupabaseClient,
  params: InsertClientParams
): Promise<{ id: string } | { error: string }> {
  const base = {
    current_service_id: params.serviceId,
    current_stage_id: params.stageId,
    office_id: params.officeId,
    contact_email: params.contactEmail,
  };

  const identityRows: Record<string, string>[] = [
    { user_id: params.authUserId, profile_id: params.authUserId },
    { user_id: params.authUserId },
    { profile_id: params.authUserId },
  ];

  const counselorIds = counselorFkIds({
    rowId: params.counselorRowId,
    loginId: params.counselorLoginId,
  });

  let lastMessage = "Could not create client record";

  for (const identity of identityRows) {
    for (const counselorId of counselorIds) {
      const { data, error } = await admin
        .from("clients")
        .insert({
          ...base,
          ...identity,
          counselor_id: counselorId,
        })
        .select("id")
        .single();

      if (!error && data?.id) {
        return { id: data.id as string };
      }

      lastMessage = error?.message ?? lastMessage;
      if (!error || !isRetryableClientSchemaError(error.message)) {
        return { error: lastMessage };
      }
    }
  }

  return { error: lastMessage };
}
