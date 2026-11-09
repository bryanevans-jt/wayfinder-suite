import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRendezvousAccess } from "@/lib/session";
import { TeamCalendar } from "@/components/TeamCalendar";

export default async function CalendarPage() {
  const gate = await requireRendezvousAccess();
  if (!gate.ok) {
    if (gate.status === 401) redirect("/login");
    return (
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Not Found</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/" className="text-sm font-semibold text-brand-green">
        ← Back
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-rv-display)] text-4xl text-brand-green">
        Team calendar
      </h1>
      <p className="mt-2 text-brand-black/70">
        Day, week, and month views. Use the checkboxes to show or hide people.
      </p>
      <div className="mt-8">
        <TeamCalendar />
      </div>
    </main>
  );
}
