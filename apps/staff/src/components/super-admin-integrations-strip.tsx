"use client";

import type { PortalNavState } from "@/components/portal-nav";
import Link from "next/link";

type Props = {
  onNavigate: (nav: PortalNavState) => void;
};

export function SuperAdminIntegrationsStrip({ onNavigate }: Props) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50/90 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-brand-black/50">
        Billing &amp; modules
      </span>
      <button
        type="button"
        onClick={() => onNavigate({ primary: "settings", settings: "ijp_billing" })}
        className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-brand-green shadow-sm ring-1 ring-neutral-200 hover:bg-brand-green/5"
      >
        IJP Billing settings
      </button>
      <Link
        href="/dashboard/ijp-billing"
        className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-brand-green shadow-sm ring-1 ring-neutral-200 hover:bg-brand-green/5"
      >
        IJP Billing workspace
      </Link>
      <button
        type="button"
        onClick={() => onNavigate({ primary: "settings", settings: "pre_ets" })}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-black/75 hover:bg-white hover:ring-1 hover:ring-neutral-200"
      >
        Pre-ETS settings
      </button>
    </div>
  );
}
