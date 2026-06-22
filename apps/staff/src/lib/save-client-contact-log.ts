import { CONTACT_LOG_NOTES_LABEL } from "@wayfinder/branding/constants";
import {
  buildClientActivityInsertFkIds,
  insertContactLogForClient,
  insertEsTimeEntry,
  todayLocalDate,
} from "@wayfinder/supabase";
import type { ActionResult } from "@wayfinder/supabase/error-log";
import { friendlyApplicationSaveError } from "@wayfinder/supabase/error-log";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SaveClientContactLogInput = {
  clientId: string;
  contactNotes: string;
  internalNotes: string;
  time?: {
    activityTypeId: string;
    durationMinutes: number;
    serviceDate?: string;
  };
};

async function clientFkIds(
  admin: SupabaseClient,
  clientId: string
): Promise<string[]> {
  const { data: clientRow } = await admin
    .from("clients")
    .select("id, user_id, profile_id")
    .eq("id", clientId)
    .maybeSingle();
  return clientRow ? buildClientActivityInsertFkIds(clientRow) : [clientId];
}

function narrativeForContactTime(outcome: string, internalNotes: string): string {
  const combined =
    [outcome.trim(), internalNotes.trim()].filter(Boolean).join(" — ") || outcome.trim();
  if (combined.length >= 10) {
    return combined;
  }
  const padded = `Contact: ${combined}`;
  return padded.length >= 10 ? padded : `${padded} (logged in Wayfinder Pro)`;
}

export async function saveClientContactLog(
  admin: SupabaseClient,
  userId: string,
  input: SaveClientContactLogInput
): Promise<ActionResult> {
  const outcome = input.contactNotes.trim();
  if (!outcome) {
    return { ok: false, error: `${CONTACT_LOG_NOTES_LABEL} are required.` };
  }

  const fkIds = await clientFkIds(admin, input.clientId);

  const contactLogId = await insertContactLogForClient(admin, {
    loggedBy: userId,
    fkIds,
    outcome,
    notes: input.internalNotes.trim() || null,
  });

  let warning: string | undefined;

  if (input.time?.activityTypeId && input.time.durationMinutes > 0) {
    try {
      const narrative = narrativeForContactTime(outcome, input.internalNotes);
      await insertEsTimeEntry(admin, {
        esUserId: userId,
        clientId: input.clientId,
        activityTypeId: input.time.activityTypeId,
        serviceDate: input.time.serviceDate ?? todayLocalDate(),
        durationMinutes: input.time.durationMinutes,
        narrative,
        linkedSourceType: "contact_log",
        linkedSourceId: contactLogId,
      });
    } catch (timeErr) {
      const timeMessage =
        timeErr instanceof Error ? friendlyApplicationSaveError(timeErr.message) : null;
      warning =
        timeMessage && !timeMessage.includes("We could not save this record")
          ? `Contact saved, but billable time was not recorded: ${timeMessage}`
          : "Contact saved, but billable time was not recorded. You can add time on the Timesheet page.";
      console.error("saveClientContactLog time entry failed:", timeErr);
    }
  }

  return warning ? { ok: true, warning } : { ok: true };
}
