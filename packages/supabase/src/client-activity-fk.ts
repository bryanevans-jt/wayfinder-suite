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

/** Prefer clients.id first when inserting rows that FK to clients(id). */
export function buildClientActivityInsertFkIds(row: {
  id?: string | null;
  user_id?: string | null;
  profile_id?: string | null;
}): string[] {
  const ids = [row.id, row.user_id, row.profile_id].filter(
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
  return /Could not find the '([^']+)' column|schema cache/i.test(message);
}

function isForeignKeyError(message: string): boolean {
  return /foreign key constraint|violates foreign key/i.test(message);
}

function isRetryableInsertError(message: string): boolean {
  return (
    isMissingColumnError(message) ||
    /null value in column/i.test(message) ||
    (isForeignKeyError(message) && /logged_by/i.test(message))
  );
}

function isClientIdForeignKeyError(message: string): boolean {
  return isForeignKeyError(message) && !/logged_by/i.test(message);
}

export async function insertContactLogForClient(
  supabase: SupabaseClient,
  opts: {
    loggedBy: string;
    fkIds: string[];
    outcome: string;
    notes: string | null;
  }
): Promise<string> {
  const trimmedNotes = opts.notes?.trim() || null;
  const text = opts.outcome;
  const shapes: Record<string, unknown>[] = [
    { logged_by: opts.loggedBy, public_outcome: text, notes: trimmedNotes },
    { public_outcome: text, notes: trimmedNotes },
    { logged_by: opts.loggedBy, public_outcome: text },
    { public_outcome: text },
    { logged_by: opts.loggedBy, public_outcome: text, outcome: text, notes: trimmedNotes },
    { public_outcome: text, outcome: text, notes: trimmedNotes },
    { outcome: text, notes: trimmedNotes },
    { public_outcome: text, outcome: text },
    { outcome: text },
  ];

  let lastMessage: string | undefined;

  for (const fkId of opts.fkIds) {
    for (const shape of shapes) {
      const { data, error } = await supabase
        .from("contact_logs")
        .insert({
          client_id: fkId,
          ...shape,
        })
        .select("id")
        .maybeSingle();
      if (!error && data?.id) {
        return data.id as string;
      }
      if (!error) {
        lastMessage = "Insert succeeded but no contact log id was returned";
        continue;
      }
      lastMessage = error.message;
      if (isRetryableInsertError(error.message)) {
        continue;
      }
      if (isClientIdForeignKeyError(error.message)) {
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
): Promise<string> {
  const insertRow: Record<string, unknown> = {
    status: row.status,
    company_name: row.company_name,
    notes: row.notes,
  };
  if (row.status_other_reason != null && row.status_other_reason !== "") {
    insertRow.status_other_reason = row.status_other_reason;
  }
  const employerId = row.employer_id?.trim();
  if (employerId) {
    insertRow.employer_id = employerId;
  }

  let lastMessage: string | undefined;

  for (const fkId of fkIds) {
    const { data, error } = await supabase
      .from("applications")
      .insert({
        client_id: fkId,
        ...insertRow,
      })
      .select("id")
      .maybeSingle();
    if (!error && data?.id) {
      return data.id as string;
    }
    if (!error) {
      return fkId;
    }
    lastMessage = error.message;
    if (isClientIdForeignKeyError(error.message)) {
      continue;
    }
    if (!isForeignKeyError(error.message)) {
      throw new Error(error.message);
    }
  }

  throw new Error(lastMessage ?? "Could not save application");
}
