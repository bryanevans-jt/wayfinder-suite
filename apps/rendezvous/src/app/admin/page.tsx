import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRendezvousAccess } from "@/lib/session";
import { createAdminClient, rendezvousSchema } from "@/lib/supabase/admin";
import { AdminScheduleForm } from "@/components/AdminScheduleForm";
import { buildPublicBookingUrl } from "@/lib/env";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { AppShell } from "@/components/AppShell";
import { RendezvousLogo } from "@/components/RendezvousLogo";
import { SignOutButton } from "@wayfinder/auth-ui";
import {
  displayNameForMember,
  ensureTeamMemberSchedules,
  listEligibleTeamMembers,
} from "@/lib/scheduling/team-schedules";

export default async function AdminPage() {
  const gate = await requireRendezvousAccess();
  if (!gate.ok) {
    if (gate.status === 401) redirect("/login");
    return (
      <AppShell>
        <main className="rv-shell text-center">
          <h1 className="rv-display text-3xl">Not Found</h1>
        </main>
      </AppShell>
    );
  }

  const admin = createAdminClient();
  await ensureTeamMemberSchedules(admin);

  const members = await listEligibleTeamMembers(admin);
  const staffOptions = members.map((p) => ({
    id: p.id,
    label: `${displayNameForMember(p)} (${p.role})`,
    firstName: p.first_name,
    lastName: p.last_name,
    fullName: p.full_name,
  }));

  const db = rendezvousSchema(admin);
  const { data: schedules } = await db.from("staff_schedules").select("*").order("slug");
  const scheduleIds = (schedules ?? []).map((s) => s.id as string);
  const { data: hours } = scheduleIds.length
    ? await db.from("weekly_hours").select("*").in("schedule_id", scheduleIds)
    : { data: [] };

  const scheduledUserIds = new Set(
    (schedules ?? []).map((s) => s.staff_user_id as string)
  );
  const addOptions = staffOptions.filter((s) => !scheduledUserIds.has(s.id));

  return (
    <AppShell showStaffNav signOutSlot={<SignOutButton />}>
      <main className="rv-shell">
        <Link href="/" className="rv-nav-link">
          ← Home
        </Link>
        <div className="rv-rise mt-8">
          <RendezvousLogo priority />
        </div>
        <p className="rv-kicker rv-rise rv-rise-delay-1 mt-6">Configuration</p>
        <h1 className="rv-display rv-rise rv-rise-delay-2 mt-2 text-4xl sm:text-5xl md:text-6xl">
          Admin Setup
        </h1>
        <p className="rv-rise rv-rise-delay-3 mt-3 max-w-2xl text-lg text-brand-black/70">
          Team booking pages are created automatically for every Wayfinder team member.
          Pages stay closed until you turn them on.
        </p>

        <section className="rv-rise rv-rise-delay-3 mt-12">
          <h2 className="rv-display text-2xl sm:text-3xl">Existing Schedules</h2>
          {(schedules ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-brand-black/60">None yet.</p>
          ) : (
            <div className="mt-6 space-y-8">
              {(schedules ?? []).map((s) => {
                const url = buildPublicBookingUrl(s.slug as string);
                const weeklyHours = (hours ?? [])
                  .filter((h) => h.schedule_id === s.id)
                  .map((h) => ({
                    dayOfWeek: Number(h.day_of_week),
                    startTime: String(h.start_time).slice(0, 5),
                    endTime: String(h.end_time).slice(0, 5),
                  }));
                const member = staffOptions.find((o) => o.id === s.staff_user_id);
                return (
                  <div key={s.id as string} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--rv-line)] pb-4">
                      <div>
                        <p className="text-xl font-semibold text-brand-green">
                          {(s.display_name as string) || s.slug}
                        </p>
                        <p className="text-sm text-brand-black/60">
                          {s.enabled ? "Open" : "Closed"} · /book/{s.slug as string}
                        </p>
                      </div>
                      <CopyLinkButton url={url} />
                    </div>
                    <AdminScheduleForm
                      staffOptions={member ? [member] : staffOptions}
                      initial={{
                        id: s.id as string,
                        staffUserId: s.staff_user_id as string,
                        slug: s.slug as string,
                        displayName: (s.display_name as string) || "",
                        enabled: Boolean(s.enabled),
                        meetingLengthMinutes: Number(s.meeting_length_minutes),
                        bufferMinutes: Number(s.buffer_minutes),
                        minNoticeHours: Number(s.min_notice_hours),
                        bookingWindowDays: Number(s.booking_window_days),
                        defaultLocation: (s.default_location as string) || "",
                        weeklyHours,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {addOptions.length > 0 ? (
          <section className="mt-16 border-t border-[color:var(--rv-line)] pt-12">
            <h2 className="rv-display text-2xl sm:text-3xl">Add A New Schedule</h2>
            <div className="mt-6">
              <AdminScheduleForm staffOptions={addOptions} />
            </div>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}
