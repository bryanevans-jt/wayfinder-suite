import Link from "next/link";
import type { ClientMatchResult, EmployerMatchEligibility } from "@/lib/employer-matching";

type Props = {
  matches: ClientMatchResult[];
  eligibility: EmployerMatchEligibility;
  scopeLabel?: string;
};

export function EmployerClientMatchPanel({
  matches,
  eligibility,
  scopeLabel = "your assigned clients",
}: Props) {
  return (
    <section className="rounded-xl border border-brand-green/25 bg-brand-green/5 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-green">
        Potential client matches
      </h2>
      <p className="mt-1 text-xs text-brand-black/70">
        Clients ({scopeLabel}) within 10 miles whose employment goals align with this
        employer&apos;s commonly hired position types.
      </p>

      {!eligibility.ready ? (
        <p className="mt-3 text-sm text-brand-black/75">
          {eligibility.reason === "inactive"
            ? "This employer is not active — only active employers are used for matching."
            : eligibility.reason === "missing_positions"
              ? "Add primary or secondary position types to enable client matching."
              : "Add and save a complete business address so distance can be calculated."}
        </p>
      ) : matches.length === 0 ? (
        <p className="mt-3 text-sm text-brand-black/75">
          No clients within 10 miles currently match this employer&apos;s position types. Update
          client employment goals or employer position types.
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
                  href={`/dashboard/clients/${m.id}`}
                  className="font-semibold text-brand-black underline decoration-brand-green/40 underline-offset-2 hover:decoration-brand-green"
                >
                  {m.label}
                </Link>
                <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-xs font-semibold text-brand-green">
                  {m.distanceMiles} mi
                </span>
              </div>
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
