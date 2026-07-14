"use server";

import { staffActsAsEsForClient } from "@/lib/caseload-assignee";
import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  logSystemError,
  resolveErrorActor,
  throwLoggedUserError,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { notifyUser } from "@wayfinder/supabase/notify-user";
import { formatMeetingWhen } from "@wayfinder/supabase/meeting-notify";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import { revalidatePath } from "next/cache";

type Input = {
  clientId: string;
  serviceId: string | null;
  date: string;
  time: string;
  timezone: string;
  location: string;
  address?: string;
};

function formatMeetingLocation(place: string, address?: string): string {
  const trimmedPlace = place.trim();
  const trimmedAddress = address?.trim() ?? "";
  if (trimmedPlace && trimmedAddress) {
    return `${trimmedPlace} — ${trimmedAddress}`;
  }
  return trimmedPlace || trimmedAddress;
}

export async function createMeetingRequest(input: Input) {
  const route = "server-action/createMeetingRequest";
  await assertNotPreviewMutation();
  const session = await getAppSession();
  if (!session) {
    throw new Error(USER_FACING_AUTH_REQUIRED);
  }

  const supabase = await createServerClient();
  const actor = await resolveErrorActor(supabase, session.actorUserId);

  let adminClient;
  try {
    adminClient = createServiceRoleClient();
  } catch (err) {
    await throwLoggedUserError(
      "staff",
      route,
      err instanceof Error ? err : new Error("Missing SUPABASE_SERVICE_ROLE_KEY"),
      actor,
      "We couldn't create that meeting request right now. Please try again."
    );
  }
  const admin = adminClient!;

  const assigned = await staffActsAsEsForClient(
    session.effectiveUserId,
    session.effectiveRole,
    input.clientId
  );
  if (!assigned) {
    throw new Error(USER_FACING_FORBIDDEN);
  }

  const location = formatMeetingLocation(input.location, input.address);
  if (!input.date || !input.time || !location) {
    throw new Error("Date, time, and place are required");
  }

  const startsAt = new Date(`${input.date}T${input.time}:00`);

  const { data: meetingRow, error } = await admin
    .from("client_meeting_requests")
    .insert({
      client_id: input.clientId,
      es_user_id: session.effectiveUserId,
      service_id: input.serviceId,
      starts_at: startsAt.toISOString(),
      timezone: input.timezone || "America/New_York",
      location,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (error || !meetingRow) {
    await throwLoggedUserError(
      "staff",
      route,
      error ?? new Error("Meeting insert returned no row"),
      actor,
      "We couldn't create that meeting request. Please try again."
    );
  }
  const meeting = meetingRow!;

  const { data: client } = await admin
    .from("clients")
    .select("user_id, profile_id")
    .eq("id", input.clientId)
    .maybeSingle();

  const notifyUserId =
    (client?.user_id as string | null) ?? (client?.profile_id as string | null) ?? null;

  if (notifyUserId) {
    try {
      const when = formatMeetingWhen(
        startsAt.toISOString(),
        input.timezone || "America/New_York"
      );
      await notifyUser(admin, {
        userId: notifyUserId,
        kind: "meeting_request",
        title: "New meeting request",
        body: `Your Employment Specialist invited you to meet on ${when} at ${location}.`,
        link_path: "/dashboard",
        metadata: { meeting_id: meeting.id },
        app: "client",
      });
    } catch (notifyErr) {
      console.error("createMeetingRequest notify failed:", notifyErr);
      try {
        await logSystemError(
          admin,
          {
            app: "staff",
            route,
            userId: actor.userId,
            userName: actor.userName,
            userRole: actor.userRole,
            userRoleLabel: actor.userRoleLabel,
            metadata: { stage: "notify_client", meeting_id: meeting.id },
          },
          notifyErr
        );
      } catch (logErr) {
        console.error("createMeetingRequest notify error logging failed:", logErr);
      }
    }
  }

  revalidatePath(`/dashboard/clients/${input.clientId}`);
}
