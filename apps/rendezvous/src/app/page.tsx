import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRendezvousAccess } from "@/lib/session";
import { createUserDb } from "@/lib/supabase/admin";
import { buildPublicBookingUrl } from "@/lib/env";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { SignOutButton } from "@wayfinder/auth-ui";

export default async function HomePage() {
  const gate = await requireRendezvousAccess();
  if (!gate.ok) {
    if (gate.status === 401) redirect("/login");
    return (
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Not Found</h1>
      </main>
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
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-[family-name:var(--font-rv-display)] text-5xl text-brand-green">
            Rendezvous
          </p>
          <p className="mt-2 text-brand-black/70">
            Simple scheduling for GVRA counselors.
          </p>
        </div>
        <SignOutButton />
      </div>

      {bookingUrl ? (
        <section className="mt-10 rounded-2xl border border-brand-green/15 bg-white/90 p-6 shadow-sm">
          <h2 className="text-xl font-semibold">My Booking Page</h2>
          <p className="mt-2 text-sm text-brand-black/70">
            Share this link with a GVRA counselor so they can pick a time.
          </p>
          <p className="mt-4 break-all rounded-lg bg-[var(--rv-mist)] px-3 py-2 text-sm">
            {bookingUrl}
          </p>
          <div className="mt-4">
            <CopyLinkButton url={bookingUrl} />
          </div>
          <p className="mt-3 text-sm text-brand-black/60">
            Status:{" "}
            <strong>{mySchedule?.enabled ? "Open for booking" : "Closed"}</strong>
          </p>
        </section>
      ) : (
        <section className="mt-10 rounded-2xl border border-brand-green/15 bg-white/90 p-6 shadow-sm">
          <h2 className="text-xl font-semibold">My Booking Page</h2>
          <p className="mt-2 text-sm text-brand-black/70">
            No booking page is set up for your account yet. Use Admin setup to add one.
          </p>
        </section>
      )}

      <nav className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link href="/calendar" className="rv-btn-primary">
          Team calendar
        </Link>
        <Link href="/admin" className="rv-btn-secondary">
          Admin setup
        </Link>
      </nav>
    </main>
  );
}
