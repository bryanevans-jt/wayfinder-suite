"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PreEtsAuthorizationsPanel } from "@/components/pre-ets-authorizations-panel";
import { PreEtsSearchPanel } from "@/components/pre-ets-search-panel";
import { PreEtsSessionsPanel } from "@/components/pre-ets-sessions-panel";
import { PreEtsWorksheetPanel } from "@/components/pre-ets-worksheet-panel";

type Tab = "worksheets" | "authorizations" | "sessions" | "search";

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
  const [tab, setTab] = useState<Tab>("worksheets");

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

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "worksheets", label: "Worksheets", show: access.canAccounts },
    { id: "authorizations", label: "Rosters & auths", show: access.canAccess },
    { id: "sessions", label: "Sessions & reports", show: access.canDeliver || access.canSupervise },
    { id: "search", label: "Search", show: access.canAccess },
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
          Pre-Employment Transition Services
        </p>
        <h1 className="mt-1 text-2xl font-bold text-brand-black">Pre-ETS</h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-black/70">
          School year <strong>{settings?.school_year ?? "—"}</strong>. Upload district worksheets,
          manage rosters and authorizations, schedule sessions, and print sign-in rosters.
        </p>
        {access.canManageSettings ? (
          <p className="mt-2 text-sm">
            <Link
              href="/dashboard/super-admin"
              className="font-semibold text-brand-green hover:underline"
            >
              Super Admin → Settings → Pre-ETS
            </Link>{" "}
            for Drive folders, templates, and role rollout.
          </p>
        ) : null}
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-neutral-200 pb-3">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === t.id
                  ? "bg-brand-green/10 text-brand-green"
                  : "text-brand-black/70 hover:bg-neutral-100"
              }`}
            >
              {t.label}
            </button>
          ))}
      </nav>

      {tab === "worksheets" && access.canAccounts ? <PreEtsWorksheetPanel /> : null}
      {tab === "authorizations" ? <PreEtsAuthorizationsPanel /> : null}
      {tab === "sessions" ? <PreEtsSessionsPanel /> : null}
      {tab === "search" ? <PreEtsSearchPanel /> : null}
    </div>
  );
}
