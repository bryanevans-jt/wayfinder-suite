import type { SupabaseClient } from "@supabase/supabase-js";

type ClientFkRow = {
  id: string;
  user_id?: string | null;
  profile_id?: string | null;
};

/** IDs that legacy timeline tables may use for client_id (profiles.id vs clients.id). */
export function buildClientActivityFkIds(row: {
  id?: string | null;
  user_id?: string | null;
  profile_id?: string | null;
}): string[] {
  const ids = [row.user_id, row.profile_id, row.id].filter(
    (v): v is string => typeof v === "string" && v.length > 0
  );
  return [...new Set(ids)];
}

export type ClientActivityFkContext = {
  clientId: string;
  fkIds: string[];
};

export async function loadClientActivityFkContext(
  supabase: SupabaseClient,
  linkId: string
): Promise<ClientActivityFkContext | null> {
  const withProfile = "id, user_id, profile_id";
  const basic = "id, user_id";

  async function loadBy(
    column: "id" | "user_id" | "profile_id",
    value: string
  ): Promise<ClientFkRow | null> {
    let result = await supabase.from("clients").select(withProfile).eq(column, value).maybeSingle();
    if (result.error?.message.includes("profile_id")) {
      result = await supabase.from("clients").select(basic).eq(column, value).maybeSingle();
    }
    if (result.error || !result.data?.id) {
      return null;
    }
    return result.data as ClientFkRow;
  }

  const row =
    (await loadBy("id", linkId)) ??
    (await loadBy("user_id", linkId)) ??
    (await loadBy("profile_id", linkId));

  if (!row) {
    return null;
  }

  return {
    clientId: row.id,
    fkIds: buildClientActivityFkIds(row),
  };
}

function isMissingColumnError(message: string): boolean {
  return /Could not find the '([^']+)' column/.test(message);
}

function isForeignKeyError(message: string): boolean {
  return /foreign key constraint|violates foreign key/i.test(message);
}

export async function insertContactLogForClient(
  supabase: SupabaseClient,
  opts: {
    loggedBy: string;
    fkIds: string[];
    outcome: string;
    notes: string | null;
  }
): Promise<void> {
  const trimmedNotes = opts.notes?.trim() || null;
  const shapes: Record<string, unknown>[] = [
    { logged_by: opts.loggedBy, public_outcome: opts.outcome, notes: trimmedNotes },
    { public_outcome: opts.outcome, notes: trimmedNotes },
    { outcome: opts.outcome, notes: trimmedNotes },
    { public_outcome: opts.outcome },
    { outcome: opts.outcome },
  ];

  let lastMessage: string | undefined;

  for (const fkId of opts.fkIds) {
    for (const shape of shapes) {
      const { error } = await supabase.from("contact_logs").insert({
        client_id: fkId,
        ...shape,
      });
      if (!error) {
        return;
      }
      lastMessage = error.message;
      if (isMissingColumnError(error.message)) {
        continue;
      }
      if (isForeignKeyError(error.message)) {
        break;
      }
      throw new Error(error.message);
    }
  }

  throw new Error(lastMessage ?? "Could not save contact log");
}

export async function insertApplicationForClient(
  supabase: SupabaseClient,
  fkIds: string[],
  row: {
    status: string;
    company_name: string;
    notes: string | null;
    status_other_reason?: string | null;
    employer_id?: string | null;
  }
): Promise<void> {
  let lastMessage: string | undefined;

  for (const fkId of fkIds) {
    const { error } = await supabase.from("applications").insert({
      client_id: fkId,
      ...row,
    });
    if (!error) {
      return;
    }
    lastMessage = error.message;
    if (!isForeignKeyError(error.message)) {
      throw new Error(error.message);
    }
  }

  throw new Error(lastMessage ?? "Could not save application");
}
