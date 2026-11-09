import { cronAuthorized, rendezvousAppBaseUrl } from "@/lib/env";
import { createAdminClient, rendezvousSchema } from "@/lib/supabase/admin";
import { getStaffEmail } from "@/lib/db";
import { stopWatchChannel, watchPrimaryCalendar } from "@/lib/google/calendar";
import { loadRendezvousFeatureEnabled } from "@/lib/access";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!(await loadRendezvousFeatureEnabled(admin))) {
    return NextResponse.json({ ok: true, skipped: "feature_disabled" });
  }

  const webhookUrl = `${rendezvousAppBaseUrl()}/api/google/webhook`;
  const token = process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN?.trim() || "rendezvous";
  const soon = new Date(Date.now() + 36 * 3_600_000).toISOString();

  const db = rendezvousSchema(admin);
  const { data: expiring } = await db
    .from("calendar_watch_channels")
    .select("*")
    .lt("expiration", soon);

  const { data: schedules } = await db
    .from("staff_schedules")
    .select("staff_user_id, google_calendar_id, enabled")
    .eq("enabled", true);

  const staffNeedingWatch = new Set(
    (schedules ?? []).map((s) => s.staff_user_id as string)
  );
  for (const ch of expiring ?? []) {
    staffNeedingWatch.add(ch.staff_user_id as string);
  }

  let renewed = 0;
  const errors: string[] = [];

  for (const staffUserId of staffNeedingWatch) {
    const staff = await getStaffEmail(admin, staffUserId);
    if (!staff) continue;
    const schedule = (schedules ?? []).find((s) => s.staff_user_id === staffUserId);
    const calendarId = (schedule?.google_calendar_id as string) || "primary";

    const existing = (expiring ?? []).filter((c) => c.staff_user_id === staffUserId);
    for (const ch of existing) {
      try {
        await stopWatchChannel({
          staffEmail: staff.email,
          channelId: ch.channel_id as string,
          resourceId: ch.resource_id as string,
        });
      } catch {
        // expired channels may already be gone
      }
      await db.from("calendar_watch_channels").delete().eq("id", ch.id);
    }

    try {
      const watch = await watchPrimaryCalendar({
        staffEmail: staff.email,
        calendarId,
        webhookUrl,
        channelToken: token,
      });
      await db.from("calendar_watch_channels").insert({
        staff_user_id: staffUserId,
        channel_id: watch.channelId,
        resource_id: watch.resourceId,
        calendar_id: calendarId,
        expiration: watch.expiration.toISOString(),
      });
      renewed++;
    } catch (err) {
      errors.push(
        `${staff.email}: ${err instanceof Error ? err.message : "watch failed"}`
      );
    }
  }

  return NextResponse.json({ ok: true, renewed, errors });
}
