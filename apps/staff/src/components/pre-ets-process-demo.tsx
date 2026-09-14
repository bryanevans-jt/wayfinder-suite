"use client";

import {
  PreEtsDemoAuthorizationsPanel,
  PreEtsDemoNotificationsPanel,
  PreEtsDemoPipelinePanel,
  PreEtsDemoSessionsPanel,
  PreEtsDemoWorksheetPanel,
} from "@/components/pre-ets-demo-panels";
import { PreEtsDemoWorkspaceChrome } from "@/components/pre-ets-demo-workspace-chrome";
import { getDemoSnapshot } from "@/lib/pre-ets-demo-mock-data";
import {
  PRE_ETS_DEMO_STEPS,
  demoPanelHint,
  demoSuggestedWorkspaceTab,
  demoWorkspaceTabsForRole,
  type PreEtsDemoRole,
  type PreEtsDemoWorkspaceTabId,
} from "@/lib/pre-ets-demo-scenario";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const ROLE_TABS: { id: PreEtsDemoRole; label: string }[] = [
  { id: "supervisor", label: "Supervisor" },
  { id: "accounts", label: "Accounts / Admin" },
  { id: "field", label: "TS / TI" },
];

export function PreEtsProcessDemo() {
  const [role, setRole] = useState<PreEtsDemoRole>("supervisor");
  const [step, setStep] = useState(1);
  const [workspaceTab, setWorkspaceTab] = useState<PreEtsDemoWorkspaceTabId>("worksheets");

  const currentStep = PRE_ETS_DEMO_STEPS.find((s) => s.id === step) ?? PRE_ETS_DEMO_STEPS[0]!;
  const snapshot = useMemo(() => getDemoSnapshot(step), [step]);
  const workspaceTabs = useMemo(() => demoWorkspaceTabsForRole(role), [role]);

  useEffect(() => {
    setWorkspaceTab(demoSuggestedWorkspaceTab(role, step));
  }, [role, step]);

  function renderWorkspacePanel() {
    if (workspaceTab === "worksheets" && role === "supervisor") {
      return <PreEtsDemoWorksheetPanel step={step} />;
    }
    if (workspaceTab === "pipeline") {
      return <PreEtsDemoPipelinePanel step={step} />;
    }
    if (workspaceTab === "authorizations") {
      return (
        <PreEtsDemoAuthorizationsPanel
          step={step}
          role={role}
          onAdvanceStep={setStep}
          defaultAuthTab={role === "accounts" && step <= 2 ? "pending" : "all"}
        />
      );
    }
    if (workspaceTab === "sessions") {
      return <PreEtsDemoSessionsPanel step={step} />;
    }
    return null;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">Training</p>
        <h1 className="mt-1 text-2xl font-bold text-brand-black">Pre-ETS authorization process demo</h1>
        <p className="mt-2 max-w-3xl text-sm text-brand-black/70">
          Walk through the Valdosta → Lowndes story using <strong>pre-filled sample data</strong>{" "}
          (District 9, October 2025). Nothing on this page writes to production. Use the step rail
          and role tabs to train supervisors, Accounts, and TS/TI on uploads, notifications,
          authorization entry, and field release.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/dashboard/pre-ets" className="font-semibold text-brand-green hover:underline">
            ← Back to Pre-ETS
          </Link>
          {" · "}
          <a
            href="/demo/pre-ets-sample-planning.csv"
            className="font-semibold text-brand-green hover:underline"
            download
          >
            Download sample planning CSV
          </a>
          {" · "}
          <Link
            href="/dashboard/pre-ets/demo/field-delivery"
            className="font-semibold text-brand-green hover:underline"
          >
            TS/TI roster &amp; CAR walkthrough
          </Link>
          {" · "}
          <Link
            href="/walkthrough/pre-ets/field-delivery"
            className="font-semibold text-brand-green hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Shareable link (no login)
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

      {role === "accounts" ? <PreEtsDemoNotificationsPanel step={step} /> : null}

      {role === "field" && snapshot.fieldMessage ? (
        <p
          className={`rounded-xl border p-4 text-sm ${
            snapshot.fieldBlocked
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-brand-green/30 bg-brand-green/5 text-brand-black/80"
          }`}
        >
          {snapshot.fieldMessage}
        </p>
      ) : null}

      <PreEtsDemoWorkspaceChrome
        tabs={workspaceTabs}
        activeTab={workspaceTab}
        onTabChange={(id) => setWorkspaceTab(id as PreEtsDemoWorkspaceTabId)}
      >
        {renderWorkspacePanel()}
      </PreEtsDemoWorkspaceChrome>
    </div>
  );
}
