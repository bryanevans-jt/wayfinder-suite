"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AccessPayload = {
  access?: {
    canAccess: boolean;
    canManageSettings: boolean;
    canAccounts: boolean;
    canSupervise: boolean;
    canDeliver: boolean;
    canViewHr: boolean;
  };
  settings?: {
    school_year: string;
    module_enabled: boolean;
  };
};

export function PreEtsWorkspace() {
  const [data, setData] = useState<AccessPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/pre-ets/access");
      const json = (await res.json()) as AccessPayload & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "You do not have access to Pre-ETS.");
        return;
      }
      setData(json);
    })();
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
        {error}
      </div>
    );
  }

  if (!data?.access) {
    return <p className="text-sm text-brand-black/60">Loading Pre-ETS…</p>;
  }

  const { access, settings } = data;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
          Pre-Employment Transition Services
        </p>
        <h1 className="mt-1 text-2xl font-bold text-brand-black">Pre-ETS</h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-black/70">
          School-based Pre-ETS for Georgia high school students. School year{" "}
          <strong>{settings?.school_year ?? "—"}</strong>. This workspace is in active development —
          configuration lives under Super Admin → Settings → Pre-ETS.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <WorkspaceCard
          title="District worksheets"
          description="Upload and review monthly district worksheets; approve rosters before and after GVRA authorization."
          ready={access.canAccounts}
        />
        <WorkspaceCard
          title="Sessions &amp; rosters"
          description="Print rosters, upload signed paperwork to Google Drive, and mark attendance."
          ready={access.canDeliver}
        />
        <WorkspaceCard
          title="Lesson activity reports"
          description="Draft lesson plans per scheduled session date; finalize within 24 hours of class."
          ready={access.canDeliver}
        />
        <WorkspaceCard
          title="Supervisor planning"
          description="Set session schedules, assign instructors, and review service-code alignment."
          ready={access.canSupervise}
        />
        <WorkspaceCard
          title="Invoice packets"
          description="Compile group authorization invoice packets for GVRA portal upload."
          ready={access.canAccounts}
        />
        <WorkspaceCard
          title="Search"
          description="Find students, schools, months, and authorization numbers."
          ready={access.canAccess}
        />
      </section>

      {access.canManageSettings ? (
        <p className="text-sm text-brand-black/65">
          <Link
            href="/dashboard/super-admin"
            className="font-semibold text-brand-green hover:underline"
          >
            Super Admin → Settings → Pre-ETS
          </Link>{" "}
          to configure Google Drive folders, templates, billing defaults, and role rollout.
        </p>
      ) : null}

      <section className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-brand-black/70">
        <p className="font-semibold text-brand-black">Coming next</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Hierarchical district worksheet parser (two-phase import)</li>
          <li>Session scheduling and printable rosters</li>
          <li>Signed roster upload to configured Google Drive folder</li>
          <li>Invoice packet PDF generation</li>
          <li>Global search by student, school, month, and authorization number</li>
        </ul>
      </section>
    </div>
  );
}

function WorkspaceCard({
  title,
  description,
  ready,
}: {
  title: string;
  description: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-brand-black">{title}</h2>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            ready ? "bg-brand-green/10 text-brand-green" : "bg-neutral-100 text-brand-black/50"
          }`}
        >
          {ready ? "Your access" : "Soon"}
        </span>
      </div>
      <p className="mt-2 text-sm text-brand-black/65">{description}</p>
    </div>
  );
}
