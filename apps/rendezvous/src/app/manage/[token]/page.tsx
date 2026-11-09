import { createAdminClient, rendezvousSchema } from "@/lib/supabase/admin";
import { hashBookingToken } from "@/lib/scheduling/tokens";
import { ManageCancel, ManageReschedule } from "@/components/ManageBooking";

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
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Link incomplete</h1>
      </main>
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
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Booking not found</h1>
        <p className="mt-2 text-brand-black/70">This link may have already been used.</p>
      </main>
    );
  }

  const { data: schedule } = await rendezvousSchema(admin)
    .from("staff_schedules")
    .select("slug")
    .eq("id", booking.schedule_id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-gold">Rendezvous</p>
      <h1 className="mt-2 font-[family-name:var(--font-rv-display)] text-4xl text-brand-green">
        {kind === "cancel" ? "Cancel meeting" : "Reschedule meeting"}
      </h1>
      <div className="mt-8 rounded-2xl border border-brand-green/15 bg-white/90 p-6 shadow-sm">
        {kind === "cancel" ? (
          <ManageCancel token={token} />
        ) : (
          <ManageReschedule token={token} slug={(schedule?.slug as string) || ""} />
        )}
      </div>
    </main>
  );
}
