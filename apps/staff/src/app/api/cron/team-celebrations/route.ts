import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import { isStaffRole } from "@wayfinder/supabase/roles";
import { loadFeatureToggles } from "@/lib/feature-toggles";
import {
  easternMonthDay,
  fillCelebrationTemplate,
  isAtOrAfterEasternHour,
  postGroupMeBotMessage,
} from "@/lib/groupme";
import { NextResponse } from "next/server";

type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  birthday: string | null;
  work_start_date: string | null;
  role: string | null;
  is_active: boolean | null;
};

function firstNameOf(p: ProfileRow): string {
  const f = (p.first_name ?? "").trim();
  if (f) return f;
  return (p.full_name ?? "teammate").trim().split(/\s+/)[0] || "teammate";
}

function displayName(p: ProfileRow): string {
  return (p.full_name ?? "").trim() || firstNameOf(p);
}

function monthDayFromIsoDate(iso: string): { month: number; day: number } | null {
  // Expect YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  return { month: Number(m[2]), day: Number(m[3]) };
}

function wholeYearsSince(startIso: string, asOfYmd: string): number {
  const start = monthDayFromIsoDate(startIso);
  const asOf = /^(\d{4})-(\d{2})-(\d{2})/.exec(asOfYmd);
  if (!start || !asOf) return 0;
  const startYear = Number(/^(\d{4})/.exec(startIso)?.[1] ?? 0);
  const asOfYear = Number(asOf[1]);
  let years = asOfYear - startYear;
  const asOfMd = Number(asOf[2]) * 100 + Number(asOf[3]);
  const startMd = start.month * 100 + start.day;
  if (asOfMd < startMd) years -= 1;
  return Math.max(0, years);
}

export async function GET(request: Request) {
  const route = "api/cron/team-celebrations";
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  if (auth !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    if (!isAtOrAfterEasternHour(now, 9)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Before 9:00 AM Eastern",
      });
    }

    const admin = createServiceRoleClient();
    const toggles = await loadFeatureToggles(admin);
    if (!toggles.groupmeCelebrationsEnabled) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Celebrations disabled" });
    }

    const { month, day, ymd } = easternMonthDay(now);
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, full_name, first_name, birthday, work_start_date, role, is_active")
      .eq("is_active", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const staff = ((profiles ?? []) as ProfileRow[]).filter((p) => isStaffRole(p.role));
    let birthdays = 0;
    let anniversaries = 0;
    const errors: string[] = [];

    for (const p of staff) {
      if (p.birthday) {
        const md = monthDayFromIsoDate(p.birthday);
        if (md && md.month === month && md.day === day) {
          const { data: existing } = await admin
            .from("team_celebration_sends")
            .select("id")
            .eq("profile_id", p.id)
            .eq("event_type", "birthday")
            .eq("event_date", ymd)
            .eq("channel", "groupme")
            .maybeSingle();
          if (!existing) {
            const text = fillCelebrationTemplate(toggles.celebrationBirthdayTemplate, {
              name: displayName(p),
              firstName: firstNameOf(p),
            });
            const posted = await postGroupMeBotMessage(text);
            if (posted.ok) {
              await admin.from("team_celebration_sends").insert({
                profile_id: p.id,
                event_type: "birthday",
                event_date: ymd,
                channel: "groupme",
                message: text,
              });
              birthdays += 1;
            } else if (posted.error) {
              errors.push(`birthday ${p.id}: ${posted.error}`);
            }
          }
        }
      }

      if (p.work_start_date) {
        const md = monthDayFromIsoDate(p.work_start_date);
        if (md && md.month === month && md.day === day) {
          const years = wholeYearsSince(p.work_start_date, ymd);
          if (years >= 1) {
            const { data: existing } = await admin
              .from("team_celebration_sends")
              .select("id")
              .eq("profile_id", p.id)
              .eq("event_type", "anniversary")
              .eq("event_date", ymd)
              .eq("channel", "groupme")
              .maybeSingle();
            if (!existing) {
              const text = fillCelebrationTemplate(toggles.celebrationAnniversaryTemplate, {
                name: displayName(p),
                firstName: firstNameOf(p),
                years,
              });
              const posted = await postGroupMeBotMessage(text);
              if (posted.ok) {
                await admin.from("team_celebration_sends").insert({
                  profile_id: p.id,
                  event_type: "anniversary",
                  event_date: ymd,
                  channel: "groupme",
                  message: text,
                });
                anniversaries += 1;
              } else if (posted.error) {
                errors.push(`anniversary ${p.id}: ${posted.error}`);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      date: ymd,
      birthdays,
      anniversaries,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    return respondWithCronLoggedError("staff", route, err);
  }
}
