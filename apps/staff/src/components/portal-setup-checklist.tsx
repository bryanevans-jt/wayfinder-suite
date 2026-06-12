"use client";

import type { PortalBootstrap } from "@/lib/portal-data";
import type { PortalNavState } from "@/components/portal-nav";
import { useEffect, useMemo, useState } from "react";

const DISMISS_KEY = "wayfinder-portal-setup-dismissed";

type Props = {
  bootstrap: PortalBootstrap;
  canManage: boolean;
  onNavigate: (nav: PortalNavState) => void;
};

type Step = {
  id: string;
  label: string;
  done: boolean;
  nav: PortalNavState;
  hint?: string;
};

export function PortalSetupChecklist({ bootstrap, canManage, onNavigate }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const steps = useMemo((): Step[] => {
    if (!canManage) {
      return [];
    }
    return [
      {
        id: "offices",
        label: "Add your offices",
        done: bootstrap.offices.length > 0,
        nav: { primary: "offices" },
        hint: "Locations where clients and staff are based",
      },
      {
        id: "es",
        label: "Add employment specialists",
        done: bootstrap.esStaff.length > 0,
        nav: { primary: "team", team: "es" },
        hint: "Staff who manage client caseloads",
      },
      {
        id: "counselors",
        label: "Add counselors",
        done: bootstrap.counselorStaff.length > 0,
        nav: { primary: "team", team: "counselors" },
        hint: "External partners with view-only access",
      },
      {
        id: "clients",
        label: "Add or import clients",
        done: bootstrap.clients.length > 0,
        nav: { primary: "clients" },
        hint: "Use CSV import for bulk onboarding",
      },
    ];
  }, [bootstrap, canManage]);

  const incomplete = steps.filter((s) => !s.done);
  const allDone = steps.length > 0 && incomplete.length === 0;

  if (!canManage || dismissed || allDone || steps.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-brand-black">Getting started</h2>
          <p className="mt-1 text-sm text-brand-black/70">
            Complete these steps to set up Wayfinder. You can return here anytime from the Clients
            tab.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          className="text-xs font-medium text-brand-black/50 hover:text-brand-black/70"
        >
          Dismiss
        </button>
      </div>
      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-start gap-3 text-sm">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.done
                  ? "bg-brand-green text-white"
                  : "border border-neutral-300 text-brand-black/50"
              }`}
              aria-hidden
            >
              {step.done ? "✓" : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              {step.done ? (
                <p className="text-brand-black/60 line-through">{step.label}</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate(step.nav)}
                    className="font-medium text-brand-green hover:underline"
                  >
                    {step.label}
                  </button>
                  {step.hint ? (
                    <p className="text-xs text-brand-black/55">{step.hint}</p>
                  ) : null}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
