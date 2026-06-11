"use server";

import { createServerClient, isEsRole } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
  USER_FACING_SYSTEM_ERROR,
} from "@wayfinder/supabase/error-log";
import { notifyUser } from "@wayfinder/supabase/notify-user";
import { revalidatePath } from "next/cache";

type Input = {
  clientId: string;
  serviceId: string | null;
  date: string;
  time: string;
  timezone: string;
  location: string;
};

export async function createMeetingRequest(input: Input) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(USER_FACING_AUTH_REQUIRED);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isEsRole(profile?.role)) {
    throw new Error(USER_FACING_FORBIDDEN);
  }

  const { data: assignment } = await supabase
    .from("es_client_assignments")
    .select("client_id")
    .eq("es_user_id", user.id)
    .eq("client_id", input.clientId)
    .maybeSingle();

  if (!assignment) {
    throw new Error("Client not assigned to you");
  }

  const location = input.location.trim();
  if (!input.date || !input.time || !location) {
    throw new Error("Date, time, and place are required");
  }

  const startsAt = new Date(`${input.date}T${input.time}:00`);

  const { data: meeting, error } = await supabase
    .from("client_meeting_requests")
    .insert({
      client_id: input.clientId,
      es_user_id: user.id,
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

  const { data: client } = await supabase
    .from("clients")
    .select("user_id")
    .eq("id", input.clientId)
    .maybeSingle();

  if (client?.user_id) {
    const admin = createServiceRoleClient();
    await notifyUser(admin, {
      userId: client.user_id,
      kind: "meeting_request",
      title: "New meeting request",
      body: `Your employment specialist invited you to meet on ${input.date}.`,
      link_path: "/dashboard",
      metadata: { meeting_id: meeting.id },
      app: "client",
    });
  }

  revalidatePath(`/dashboard/clients/${input.clientId}`);
}
