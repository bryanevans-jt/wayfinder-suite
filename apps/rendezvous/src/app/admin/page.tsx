import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRendezvousAccess } from "@/lib/session";
import { createAdminClient, rendezvousSchema } from "@/lib/supabase/admin";
import { AdminScheduleForm } from "@/components/AdminScheduleForm";
import { buildPublicBookingUrl } from "@/lib/env";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { isFieldSpecialistRole } from "@wayfinder/supabase/roles";

export default async function AdminPage() {
  const gate = await requireRendezvousAccess();
  if (!gate.ok) {
    if (gate.status === 401) redirect("/login");
    return (
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Not Found</h1>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("is_active", true)
    .order("full_name");

  const staffOptions = (profiles ?? [])
    .filter((p) => isFieldSpecialistRole(p.role as string) || p.role === "super_admin")
    .map((p) => ({
      id: p.id as string,
      label: `${(p.full_name as string) || "Staff"} (${p.role})`,
    }));

  const { data: schedules } = await rendezvousSchema(admin)
    .from("staff_schedules")
    .select("*")
    .order("slug");
  const scheduleIds = (schedules ?? []).map((s) => s.id as string);
  const { data: hours } = scheduleIds.length
    ? await rendezvousSchema(admin)
        .from("weekly_hours")
        .select("*")
        .in("schedule_id", scheduleIds)
    : { data: [] };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm font-semibold text-brand-green">
        ← Back
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-rv-display)] text-4xl text-brand-green">
        Admin setup
      </h1>
      <p className="mt-2 text-brand-black/70">
        Add or edit staff booking pages. Pages stay closed until you turn them on.
      </p>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Existing schedules</h2>
        {(schedules ?? []).length === 0 ? (
          <p className="text-sm text-brand-black/60">None yet.</p>
        ) : (
          (schedules ?? []).map((s) => {
            const url = buildPublicBookingUrl(s.slug as string);
            const weeklyHours = (hours ?? [])
              .filter((h) => h.schedule_id === s.id)
              .map((h) => ({
                dayOfWeek: Number(h.day_of_week),
                startTime: String(h.start_time).slice(0, 5),
                endTime: String(h.end_time).slice(0, 5),
              }));
            return (
              <div key={s.id as string} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-green/10 bg-white/80 px-4 py-3">
                  <div>
                    <p className="font-semibold">{(s.display_name as string) || s.slug}</p>
                    <p className="text-sm text-brand-black/60">
                      {s.enabled ? "Open" : "Closed"} · /book/{s.slug as string}
                    </p>
                  </div>
                  <CopyLinkButton url={url} />
                </div>
                <AdminScheduleForm
                  staffOptions={staffOptions}
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
          })
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Add a new schedule</h2>
        <div className="mt-4">
          <AdminScheduleForm staffOptions={staffOptions} />
        </div>
      </section>
    </main>
  );
}
