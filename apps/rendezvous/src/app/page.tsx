import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRendezvousAccess } from "@/lib/session";
import { createUserDb } from "@/lib/supabase/admin";
import { buildPublicBookingUrl } from "@/lib/env";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { AppShell } from "@/components/AppShell";
import { SignOutButton } from "@wayfinder/auth-ui";

export default async function HomePage() {
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

  const { db } = await createUserDb();
  const { data: mySchedule } = await db
    .from("staff_schedules")
    .select("*")
    .eq("staff_user_id", gate.session.userId)
    .maybeSingle();

  const bookingUrl = mySchedule?.slug
    ? buildPublicBookingUrl(mySchedule.slug as string)
    : null;

  return (
    <AppShell showStaffNav signOutSlot={<SignOutButton />}>
      <section className="rv-hero-plane">
        <div className="rv-hero-content mx-auto max-w-5xl">
          <h1 className="rv-rise rv-brand text-6xl sm:text-7xl md:text-8xl">Rendezvous</h1>
          <p className="rv-rise rv-rise-delay-1 mt-5 max-w-xl text-lg text-brand-black/75 sm:text-xl">
            Simple scheduling for GVRA counselors—share a link, meet on time.
          </p>
          <div className="rv-rise rv-rise-delay-2 mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/calendar" className="rv-btn-primary">
              Open Team Calendar
            </Link>
            <Link href="/admin" className="rv-btn-secondary">
              Admin Setup
            </Link>
          </div>
        </div>
      </section>

      <main className="rv-shell pt-4 sm:pt-6">
        <section className="rv-rise rv-rise-delay-3">
          <p className="rv-kicker">Your Page</p>
          <h2 className="rv-display mt-2 text-3xl sm:text-4xl">My Booking Page</h2>
          {bookingUrl ? (
            <div className="mt-6 space-y-4">
              <p className="max-w-2xl text-brand-black/70">
                Share this link with a GVRA counselor so they can pick a time.
              </p>
              <p className="break-all rounded-2xl bg-[color:var(--rv-mist)]/80 px-4 py-3 font-mono text-sm">
                {bookingUrl}
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <CopyLinkButton url={bookingUrl} />
                <p className="text-sm text-brand-black/65">
                  Status:{" "}
                  <strong className="text-brand-green">
                    {mySchedule?.enabled ? "Open For Booking" : "Closed"}
                  </strong>
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 max-w-2xl text-brand-black/70">
              No booking page is set up for your account yet. Use Admin Setup to add one.
            </p>
          )}
        </section>
      </main>
    </AppShell>
  );
}
