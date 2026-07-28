"use client";

import Link from "next/link";

export type EsClientsTodayStripProps = {
  needsReply: number;
  meetingsPending: number;
  meetingsSoon: number;
  staleApplications: number;
  noContact: number;
  activePipeline: number;
};

function Chip({
  href,
  label,
  count,
  tone = "neutral",
}: {
  href: string;
  label: string;
  count: number;
  tone?: "neutral" | "urgent" | "warn";
}) {
  if (count <= 0) return null;
  const toneClass =
    tone === "urgent"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-neutral-200 bg-white text-brand-black";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition hover:border-brand-green/40 ${toneClass}`}
    >
      <span className="tabular-nums font-semibold">{count}</span>
      <span>{label}</span>
    </Link>
  );
}

export function EsClientsTodayStrip(props: EsClientsTodayStripProps) {
  const chips = [
    props.needsReply,
    props.meetingsPending,
    props.meetingsSoon,
    props.staleApplications,
    props.noContact,
    props.activePipeline,
  ].some((n) => n > 0);

  if (!chips) {
    return (
      <section className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-black">Today</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Nothing urgent on your caseload right now.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-4">
      <h2 className="text-sm font-semibold text-brand-black">Today</h2>
      <p className="mt-1 text-sm text-brand-black/65">
        What needs attention across your caseload.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip
          href="/dashboard/messages"
          label="need a reply"
          count={props.needsReply}
          tone="urgent"
        />
        <Chip
          href="#caseload"
          label="meetings awaiting client"
          count={props.meetingsPending}
          tone="warn"
        />
        <Chip href="#caseload" label="meetings in the next 7 days" count={props.meetingsSoon} />
        <Chip
          href="#pipeline"
          label="stale applications"
          count={props.staleApplications}
          tone="warn"
        />
        <Chip href="#caseload" label="no contact in 14+ days" count={props.noContact} />
        <Chip href="#pipeline" label="active applications" count={props.activePipeline} />
      </div>
    </section>
  );
}
