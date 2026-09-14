"use client";

import type { ReactNode } from "react";

export type PreEtsDemoWorkspaceTab = {
  id: string;
  label: string;
};

type Props = {
  schoolYear?: string;
  tabs: PreEtsDemoWorkspaceTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: ReactNode;
};

/** Mirrors {@link PreEtsWorkspace} header and tab bar for training demos. */
export function PreEtsDemoWorkspaceChrome({
  schoolYear = "2025-2026",
  tabs,
  activeTab,
  onTabChange,
  children,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-brand-black/60">
        <span className="rounded-full bg-brand-gold/15 px-2 py-0.5 font-bold uppercase tracking-wide text-brand-gold">
          Training UI
        </span>
        <span>Sample data only — layout matches the live Pre-ETS page.</span>
      </div>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
          Pre-Employment Transition Services
        </p>
        <h1 className="mt-1 text-2xl font-bold text-brand-black">Pre-ETS</h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-black/70">
          School year <strong>{schoolYear}</strong>. Supervisors upload planning worksheets; Accounts
          enter authorization numbers; TS/TI work released rosters only.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-neutral-200 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              activeTab === t.id
                ? "bg-brand-green/10 text-brand-green"
                : "text-brand-black/70 hover:bg-neutral-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {children}
    </div>
  );
}
