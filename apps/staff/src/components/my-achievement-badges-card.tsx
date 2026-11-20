"use client";

import type { StaffBadgesMinePayload } from "@wayfinder/supabase/staff-badges";
import { useCallback, useEffect, useState } from "react";

type Props = {
  /** When set, skip the network and render this payload (walkthrough / screenshot). */
  demoPayload?: StaffBadgesMinePayload;
};

function MedallionIcon({ badgeKey, earned }: { badgeKey: string; earned: boolean }) {
  const stroke = earned ? "currentColor" : "#9CA3AF";
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (badgeKey.startsWith("placements_") || badgeKey === "first_placement" || badgeKey.startsWith("career_")) {
    return (
      <svg {...common}>
        <path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7L12 3z" />
      </svg>
    );
  }
  if (badgeKey.startsWith("kra_")) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M8 12l2.5 2.5L16 9" />
      </svg>
    );
  }
  if (badgeKey === "every_client_contacted") {
    return (
      <svg {...common}>
        <path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z" />
      </svg>
    );
  }
  if (badgeKey === "no_14_day_gaps") {
    return (
      <svg {...common}>
        <path d="M4 12h4l2-6 4 12 2-6h4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function shortLabel(badgeKey: string, label: string): string {
  if (badgeKey === "placements_1") return "1 place";
  if (badgeKey === "placements_2") return "2 places";
  if (badgeKey === "placements_3") return "3 places";
  if (badgeKey === "kra_50") return "KRA 50%";
  if (badgeKey === "kra_75") return "KRA 75%";
  if (badgeKey === "kra_100") return "KRA 100%";
  if (badgeKey === "every_client_contacted") return "All contacted";
  if (badgeKey === "no_14_day_gaps") return "Steady";
  if (badgeKey === "first_placement") return "First job";
  if (badgeKey.startsWith("career_placements_")) return label.replace(" career placements", "");
  return label.length > 14 ? `${label.slice(0, 12)}…` : label;
}

export function MyAchievementBadgesCard({ demoPayload }: Props) {
  const [payload, setPayload] = useState<StaffBadgesMinePayload | null>(demoPayload ?? null);
  const [loading, setLoading] = useState(!demoPayload);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (demoPayload) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/staff-badges/mine");
    const data = (await res.json()) as StaffBadgesMinePayload & { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not load badges");
      setPayload(null);
    } else {
      setPayload(data);
    }
    setLoading(false);
  }, [demoPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  const streakLine = (() => {
    if (!payload) return null;
    const parts: string[] = [];
    for (const s of payload.streaks) {
      if (s.current >= 1 || s.best >= 1) {
        const currentBit = s.current >= 1 ? `current ${s.current}` : null;
        const bestBit = s.best >= 1 ? `best ${s.best}` : null;
        const joined = [currentBit, bestBit].filter(Boolean).join(" · ");
        if (joined) parts.push(`${s.label}: ${joined}`);
      }
    }
    return parts.length > 0 ? parts.join("  ·  ") : "Start a streak this month — every contact and placement counts.";
  })();

  return (
    <section className="mt-6 rounded-xl border border-brand-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-brand-black">My Badges</h2>
          <p className="mt-0.5 text-sm text-brand-black/65">
            {payload?.monthLabel ? `${payload.monthLabel} progress` : "This month’s progress"}
          </p>
        </div>
        {loading ? <p className="text-sm text-brand-black/55">Loading…</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>

      {!loading && !error && payload ? (
        <>
          <ul className="mt-5 flex flex-wrap justify-start gap-4 sm:gap-5">
            {payload.medallions.map((m) => {
              const earned = m.earned;
              const pct = Math.round(Math.min(1, Math.max(0, m.progress)) * 100);
              return (
                <li key={m.badgeKey} className="flex w-[4.75rem] flex-col items-center text-center">
                  <div
                    className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 ${
                      earned
                        ? "border-brand-green bg-brand-green/10 text-brand-green"
                        : "border-brand-black/15 bg-brand-black/[0.03] text-brand-black/40"
                    }`}
                    title={m.description}
                  >
                    <MedallionIcon badgeKey={m.badgeKey} earned={earned} />
                    {!earned ? (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-brand-black/15 bg-white text-brand-black/50"
                        aria-hidden
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <rect x="5" y="11" width="14" height="10" rx="2" />
                          <path d="M8 11V8a4 4 0 018 0v3" />
                        </svg>
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={`mt-2 text-[11px] font-medium leading-tight ${
                      earned ? "text-brand-black" : "text-brand-black/55"
                    }`}
                  >
                    {shortLabel(m.badgeKey, m.label)}
                  </p>
                  {!earned && m.detail ? (
                    <div className="mt-1.5 w-full">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-brand-black/10">
                        <div
                          className="h-full rounded-full bg-brand-green/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-[10px] tabular-nums text-brand-black/50">{m.detail}</p>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[10px] text-brand-green">Earned</p>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="mt-5 text-sm text-brand-black/70">{streakLine}</p>
        </>
      ) : null}
    </section>
  );
}
