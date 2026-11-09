import { createAdminClient, rendezvousSchema } from "@/lib/supabase/admin";
import { invalidateBusyCache } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * Google Calendar push notification receiver.
 * Invalidates free/busy cache for the channel's staff user.
 */
export async function POST(request: Request) {
  const channelId = request.headers.get("x-goog-channel-id");
  const resourceState = request.headers.get("x-goog-resource-state");
  const channelToken = request.headers.get("x-goog-channel-token");
  const expectedToken = process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN?.trim();

  if (!channelId) {
    return NextResponse.json({ error: "Missing channel" }, { status: 400 });
  }
  if (expectedToken && channelToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sync handshake — acknowledge without work.
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  const { data: channel } = await rendezvousSchema(admin)
    .from("calendar_watch_channels")
    .select("staff_user_id")
    .eq("channel_id", channelId)
    .maybeSingle();

  if (channel?.staff_user_id) {
    await invalidateBusyCache(admin, channel.staff_user_id as string);
  }

  return NextResponse.json({ ok: true });
}
