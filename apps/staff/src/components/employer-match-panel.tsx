import Link from "next/link";
import type { EmployerMatchResult } from "@/lib/employer-matching";

type Props = {
  matches: EmployerMatchResult[];
  missingGoals: boolean;
  missingGeocode: boolean;
};

export function EmployerMatchPanel({ matches, missingGoals, missingGeocode }: Props) {
  return (
    <section className="rounded-xl border border-brand-green/25 bg-brand-green/5 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-green">
        Potential employer matches
      </h2>
      <p className="mt-1 text-xs text-brand-black/70">
        Active employers within 10 miles whose commonly hired position types align with this
        client&apos;s employment goals.
      </p>

      {missingGoals ? (
        <p className="mt-3 text-sm text-brand-black/75">
          Add a primary or secondary employment goal to see matches.
        </p>
      ) : missingGeocode ? (
        <p className="mt-3 text-sm text-brand-black/75">
          Add and save a complete home address so Wayfinder can calculate distance to employers.
        </p>
      ) : matches.length === 0 ? (
        <p className="mt-3 text-sm text-brand-black/75">
          No active employers within 10 miles match this client&apos;s goals right now. Try
          expanding the Community Partners Network or updating position types on nearby employers.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {matches.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-brand-green/20 bg-white px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link
                  href={`/dashboard/community-partners/${m.id}`}
                  className="font-semibold text-brand-black underline decoration-brand-green/40 underline-offset-2 hover:decoration-brand-green"
                >
                  {m.name}
                </Link>
                <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-xs font-semibold text-brand-green">
                  {m.distanceMiles} mi
                </span>
              </div>
              <p className="mt-1 text-brand-black/65">
                {[m.city, m.state].filter(Boolean).join(", ") || "Location not listed"}
              </p>
              <p className="mt-2 text-brand-black/80">
                <span className="font-medium">Matching goals:</span> {m.matchedGoals.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
