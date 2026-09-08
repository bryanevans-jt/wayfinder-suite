import { CONTACT_LOG_NOTES_LABEL } from "@wayfinder/branding/constants";
import {
  buildClientActivityInsertFkIds,
  insertContactLogForClient,
  insertEsTimeEntry,
  todayLocalDate,
} from "@wayfinder/supabase";
import type { ActionResult } from "@wayfinder/supabase/error-log";
import { friendlyApplicationSaveError } from "@wayfinder/supabase/error-log";
import { resolveEpisodeForActivity } from "@wayfinder/supabase/service-episodes";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordContactLogEvent } from "@/lib/contact-log-events";

export type SaveClientContactLogInput = {
  clientId: string;
  contactNotes: string;
  internalNotes: string;
  serviceEpisodeId?: string | null;
  clientPresent?: boolean;
  deliveryMode?: "in_person" | "virtual" | "phone" | null;
  time?: {
    activityTypeId: string;
    durationMinutes: number;
    serviceDate?: string;
    startTime?: string;
    endTime?: string;
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

  const episodeResolution = await resolveEpisodeForActivity(admin, {
    clientId: input.clientId,
    episodeId: input.serviceEpisodeId,
  });

  if (episodeResolution.needsPicker) {
    return {
      ok: false,
      error:
        "This client has more than one active authorization. Select which service this activity belongs to.",
    };
  }

  const episodeId = episodeResolution.episodeId;

  const contactLogId = await insertContactLogForClient(admin, {
    loggedBy: userId,
    fkIds,
    outcome,
    notes: input.internalNotes.trim() || null,
  });

  if (episodeId) {
    await admin
      .from("contact_logs")
      .update({ service_episode_id: episodeId })
      .eq("id", contactLogId);
  }

  await recordContactLogEvent(admin, {
    contactLogId,
    clientId: input.clientId,
    actorUserId: userId,
    eventKind: "created",
    after: {
      public_outcome: outcome,
      notes: input.internalNotes.trim() || null,
    },
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
        startTime: input.time.startTime,
        endTime: input.time.endTime,
        recordedAt: new Date(),
        narrative,
        linkedSourceType: "contact_log",
        linkedSourceId: contactLogId,
        serviceEpisodeId: episodeId,
        clientPresent: input.clientPresent === true,
        deliveryMode: input.deliveryMode ?? null,
      });
    } catch (timeErr) {
      const timeMessage =
        timeErr instanceof Error ? friendlyApplicationSaveError(timeErr.message) : null;
      warning =
        timeMessage && !timeMessage.includes("We could not save this record")
          ? `Contact saved, but service time was not recorded: ${timeMessage}`
          : "Contact saved, but service time was not recorded. You can add time on the Timesheet page.";
      console.error("saveClientContactLog time entry failed:", timeErr);
    }
  }

  const { markIntakeReadyAfterContactLog } = await import(
    "@wayfinder/supabase/intake-billing"
  );
  await markIntakeReadyAfterContactLog(admin, {
    clientId: input.clientId,
    reason: "contact_log",
    loggedByUserId: userId,
  });

  return warning ? { ok: true, warning } : { ok: true };
}
