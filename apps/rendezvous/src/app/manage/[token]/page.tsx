import { createAdminClient, rendezvousSchema } from "@/lib/supabase/admin";
import { hashBookingToken } from "@/lib/scheduling/tokens";
import { ManageCancel, ManageReschedule } from "@/components/ManageBooking";
import { AppShell } from "@/components/AppShell";

type Params = Promise<{ token: string }>;
type SearchParams = Promise<{ token?: string; action?: string }>;

/**
 * Supports:
 * - /manage/cancel?token=...
 * - /manage/reschedule?token=...
 * - /manage/[token]?action=cancel|reschedule (legacy-friendly)
 */
export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { token: pathToken } = await params;
  const sp = await searchParams;

  const kind =
    pathToken === "cancel" || pathToken === "reschedule"
      ? pathToken
      : sp.action === "reschedule"
        ? "reschedule"
        : "cancel";
  const token = pathToken === "cancel" || pathToken === "reschedule" ? sp.token ?? "" : pathToken;

  if (!token) {
    return (
      <AppShell>
        <main className="rv-shell text-center">
          <h1 className="rv-display text-3xl">Link Incomplete</h1>
        </main>
      </AppShell>
    );
  }

  const admin = createAdminClient();
  const hash = hashBookingToken(token);
  const column = kind === "cancel" ? "cancel_token_hash" : "reschedule_token_hash";
  const { data: booking } = await rendezvousSchema(admin)
    .from("bookings")
    .select("id, status, schedule_id")
    .eq(column, hash)
    .maybeSingle();

  if (!booking || booking.status !== "confirmed") {
    return (
      <AppShell>
        <main className="rv-shell text-center">
          <h1 className="rv-display text-3xl">Booking Not Found</h1>
          <p className="mt-3 text-brand-black/70">This link may have already been used.</p>
        </main>
      </AppShell>
    );
  }

  const { data: schedule } = await rendezvousSchema(admin)
    .from("staff_schedules")
    .select("slug")
    .eq("id", booking.schedule_id)
    .maybeSingle();

  return (
    <AppShell>
      <section className="rv-hero-plane min-h-[min(48vh,420px)]">
        <div className="rv-hero-content mx-auto max-w-5xl">
          <p className="rv-kicker rv-rise">Rendezvous</p>
          <h1 className="rv-brand rv-rise rv-rise-delay-1 mt-3 text-5xl sm:text-6xl">
            {kind === "cancel" ? "Cancel Meeting" : "Reschedule Meeting"}
          </h1>
        </div>
      </section>
      <main className="rv-shell -mt-10 pb-16">
        <div className="rv-panel rounded-3xl p-6">
          {kind === "cancel" ? (
            <ManageCancel token={token} />
          ) : (
            <ManageReschedule token={token} slug={(schedule?.slug as string) || ""} />
          )}
        </div>
      </main>
    </AppShell>
  );
}
