"use server";

import { isEsRole } from "@wayfinder/supabase/roles";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
  USER_FACING_SYSTEM_ERROR,
} from "@wayfinder/supabase/error-log";
import { notifyUser } from "@wayfinder/supabase/notify-user";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import { revalidatePath } from "next/cache";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";

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
  await assertNotPreviewMutation();
  const session = await getAppSession();
  if (!session) {
    throw new Error(USER_FACING_AUTH_REQUIRED);
  }

  if (!isEsRole(session.effectiveRole)) {
    throw new Error(USER_FACING_FORBIDDEN);
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    throw new Error("Server configuration error");
  }

  const assigned = await esIsAssignedToClient(session.effectiveUserId, input.clientId);
  if (!assigned) {
    throw new Error("Client not assigned to you");
  }

  const location = formatMeetingLocation(input.location, input.address);
  if (!input.date || !input.time || !location) {
    throw new Error("Date, time, and place are required");
  }

  const startsAt = new Date(`${input.date}T${input.time}:00`);

  const { data: meeting, error } = await admin
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

  if (error || !meeting) {
    console.error("createMeetingRequest failed:", error);
    throw new Error(USER_FACING_SYSTEM_ERROR);
  }

  const { data: client } = await admin
    .from("clients")
    .select("user_id, profile_id")
    .eq("id", input.clientId)
    .maybeSingle();

  const notifyUserId =
    (client?.user_id as string | null) ?? (client?.profile_id as string | null) ?? null;

  if (notifyUserId) {
    try {
      await notifyUser(admin, {
        userId: notifyUserId,
        kind: "meeting_request",
        title: "New meeting request",
        body: `Your employment specialist invited you to meet on ${input.date}.`,
        link_path: "/dashboard",
        metadata: { meeting_id: meeting.id },
        app: "client",
      });
    } catch (notifyErr) {
      console.error("createMeetingRequest notify failed:", notifyErr);
    }
  }

  revalidatePath(`/dashboard/clients/${input.clientId}`);
}
