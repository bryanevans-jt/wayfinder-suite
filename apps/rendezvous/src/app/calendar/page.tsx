import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRendezvousAccess } from "@/lib/session";
import { TeamCalendar } from "@/components/TeamCalendar";
import { AppShell } from "@/components/AppShell";
import { SignOutButton } from "@wayfinder/auth-ui";

export default async function CalendarPage() {
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

  return (
    <AppShell showStaffNav signOutSlot={<SignOutButton />}>
      <main className="rv-shell">
        <Link href="/" className="rv-nav-link">
          ← Home
        </Link>
        <p className="rv-kicker rv-rise mt-8">Schedule</p>
        <h1 className="rv-display rv-rise rv-rise-delay-1 mt-2 text-4xl sm:text-5xl md:text-6xl">
          Team Calendar
        </h1>
        <p className="rv-rise rv-rise-delay-2 mt-3 max-w-2xl text-lg text-brand-black/70">
          Day, week, and month views. Use the checkboxes to show or hide people.
        </p>
        <div className="rv-rise rv-rise-delay-3 mt-10">
          <TeamCalendar />
        </div>
      </main>
    </AppShell>
  );
}
