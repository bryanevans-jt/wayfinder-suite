"use client";

import { PreEtsWorksheetPanel } from "@/components/pre-ets-worksheet-panel";
import { PreEtsAuthorizationsPanel } from "@/components/pre-ets-authorizations-panel";
import { PreEtsSessionsPanel } from "@/components/pre-ets-sessions-panel";
import {
  PRE_ETS_DEMO_STEPS,
  demoPanelHint,
  type PreEtsDemoRole,
} from "@/lib/pre-ets-demo-scenario";
import Link from "next/link";
import { useState } from "react";

const ROLE_TABS: { id: PreEtsDemoRole; label: string }[] = [
  { id: "supervisor", label: "Supervisor" },
  { id: "accounts", label: "Accounts / Admin" },
  { id: "field", label: "TS / TI" },
];

export function PreEtsProcessDemo() {
  const [role, setRole] = useState<PreEtsDemoRole>("supervisor");
  const [step, setStep] = useState(1);

  const currentStep = PRE_ETS_DEMO_STEPS.find((s) => s.id === step) ?? PRE_ETS_DEMO_STEPS[0]!;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">Training</p>
        <h1 className="mt-1 text-2xl font-bold text-brand-black">Pre-ETS authorization process demo</h1>
        <p className="mt-2 max-w-3xl text-sm text-brand-black/70">
          Use the step rail to walk through Valdosta → Lowndes. Each role tab shows the{" "}
          <strong>same production panels</strong> staff use in Pre-ETS (live data when you are logged
          in with access). Banners describe what changes at each step.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/dashboard/pre-ets" className="font-semibold text-brand-green hover:underline">
            ← Back to Pre-ETS
          </Link>
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {ROLE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setRole(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              role === t.id
                ? "bg-brand-green/10 text-brand-green"
                : "text-brand-black/70 hover:bg-neutral-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <ol className="flex flex-wrap gap-2">
        {PRE_ETS_DEMO_STEPS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setStep(s.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                step === s.id
                  ? "bg-brand-gold text-white"
                  : "bg-neutral-100 text-brand-black/70 hover:bg-neutral-200"
              }`}
            >
              Step {s.id}
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
        <p className="text-sm font-semibold text-brand-black">
          Step {currentStep.id}: {currentStep.title}
        </p>
        <p className="mt-1 text-sm text-brand-black/75">{currentStep.summary}</p>
        <p className="mt-2 text-sm text-brand-black/80">
          <span className="font-medium capitalize">{role.replace("_", " ")} view:</span>{" "}
          {demoPanelHint(role, step)}
        </p>
      </div>

      {role === "supervisor" ? (
        <div className="space-y-8">
          {(step === 1 || step >= 5) && <PreEtsWorksheetPanel />}
          <PreEtsAuthorizationsPanel />
        </div>
      ) : null}

      {role === "accounts" ? (
        <div className="space-y-6">
          {step >= 2 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm">
              <p className="text-xs font-semibold uppercase text-brand-black/55">Sample notification</p>
              <p className="mt-2 font-medium text-brand-black">
                Pre-ETS authorization requests submitted
              </p>
              <p className="mt-1 text-brand-black/75">
                {step >= 5
                  ? "Authorization requests submitted for Valdosta High and Lowndes High - Self Contained."
                  : "Authorization requests submitted for Valdosta High."}
              </p>
            </div>
          ) : null}
          <PreEtsAuthorizationsPanel />
        </div>
      ) : null}

      {role === "field" ? (
        <div className="space-y-4">
          {step < 4 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              No released rosters yet for this step. TS/TI only see authorizations after Accounts
              enters the GVRA authorization number.
            </p>
          ) : (
            <p className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4 text-sm text-brand-black/80">
              {step === 4
                ? "Valdosta High roster is released — sessions and sign-in PDFs are available below."
                : "Valdosta remains available; Lowndes appears here only after Accounts finalizes it (step not shown yet in live data)."}
            </p>
          )}
          {step >= 4 ? <PreEtsSessionsPanel /> : null}
          {step >= 4 ? <PreEtsAuthorizationsPanel /> : null}
        </div>
      ) : null}
    </div>
  );
}
