import { createAdminClient } from "@/lib/supabase/admin";
import { getScheduleBySlug, getStaffEmail } from "@/lib/db";
import {
  isPublicBookingAllowed,
  loadRendezvousFeatureEnabled,
} from "@/lib/access";
import { BookingPage } from "@/components/BookingPage";
import { AppShell } from "@/components/AppShell";

type Params = Promise<{ slug: string }>;

export default async function PublicBookPage({ params }: { params: Params }) {
  const { slug } = await params;
  const admin = createAdminClient();
  const featureEnabled = await loadRendezvousFeatureEnabled(admin);
  const schedule = await getScheduleBySlug(admin, slug);

  if (
    !schedule ||
    !isPublicBookingAllowed({ featureEnabled, scheduleEnabled: schedule.enabled })
  ) {
    return (
      <AppShell>
        <main className="rv-shell text-center">
          <h1 className="rv-display text-3xl sm:text-4xl">Booking Unavailable</h1>
          <p className="mt-3 text-brand-black/70">
            This scheduling page is not open right now.
          </p>
        </main>
      </AppShell>
    );
  }

  const staff = await getStaffEmail(admin, schedule.staff_user_id);
  const staffName = schedule.display_name?.trim() || staff?.fullName || "Specialist";

  return <BookingPage slug={slug} staffName={staffName} />;
}
