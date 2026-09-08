import type { SupabaseClient } from "@supabase/supabase-js";

/** Postgres / PostgREST errors when a column or table is not in the schema cache yet. */
export function isMissingSchemaError(message: string): boolean {
  return (
    /does not exist/i.test(message) ||
    /Could not find the '/i.test(message) ||
    /schema cache/i.test(message) ||
    /relation .* does not exist/i.test(message)
  );
}

export function isMissingColumnError(message: string): boolean {
  return /Could not find the '([^']+)' column|column .* does not exist|schema cache/i.test(
    message
  );
}

export function isMissingTableError(message: string): boolean {
  return (
    /relation "public\.service_episodes" does not exist/i.test(message) ||
    /relation "public\.participants" does not exist/i.test(message) ||
    (/Could not find the table/i.test(message) &&
      /service_episodes|participants|participant_link_flags/i.test(message))
  );
}

let vocationalEpisodesSchemaAvailable: boolean | null = null;

/** True when service_episodes exists (migration applied). Result is cached for the process lifetime. */
export async function isVocationalEpisodesSchemaAvailable(
  admin: SupabaseClient
): Promise<boolean> {
  if (vocationalEpisodesSchemaAvailable !== null) {
    return vocationalEpisodesSchemaAvailable;
  }

  const { error } = await admin.from("service_episodes").select("id").limit(0);
  if (error && (isMissingSchemaError(error.message) || isMissingTableError(error.message))) {
    vocationalEpisodesSchemaAvailable = false;
    return false;
  }

  vocationalEpisodesSchemaAvailable = !error;
  return vocationalEpisodesSchemaAvailable;
}
