"use client";

import {
  DEMO_DISTRICT,
  DEMO_SERVICE_MONTH,
  type DemoAuthorization,
  type DemoRosterStudent,
  getDemoSnapshot,
} from "@/lib/pre-ets-demo-mock-data";
import type { PreEtsDemoRole } from "@/lib/pre-ets-demo-scenario";
import { Fragment, useMemo, useState, type ReactNode } from "react";

function DemoBadge() {
  return (
    <span className="rounded-full bg-brand-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-gold">
      Training sample data
    </span>
  );
}

function panelShell(title: string, description: string, children: ReactNode) {
  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-brand-black">{title}</h2>
            <DemoBadge />
          </div>
          <p className="mt-1 text-sm text-brand-black/65">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function PreEtsDemoWorksheetPanel({ step }: { step: number }) {
  const snapshot = useMemo(() => getDemoSnapshot(step), [step]);

  return panelShell(
    "District worksheet import",
    "Supervisors upload planning CSVs (no GVRA auth numbers). Imports auto-commit to pending rosters.",
    <>
      <div className="flex flex-wrap gap-3">
        <span className="cursor-not-allowed rounded-lg bg-brand-gold/40 px-4 py-2 text-sm font-semibold text-white/90">
          Upload CSV (disabled in demo)
        </span>
        <a
          href="/demo/pre-ets-sample-planning.csv"
          download
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-brand-green hover:bg-neutral-50"
        >
          Download sample planning CSV
        </a>
      </div>
      <p className="text-xs text-brand-black/55">
        Sample file: District {DEMO_DISTRICT}, {DEMO_SERVICE_MONTH}, Valdosta
        {step >= 5 ? " + Lowndes on re-upload" : ""}.
      </p>
      <div className="overflow-x-auto rounded-lg border border-neutral-100">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">Committed</th>
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">Groups</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.worksheetImports.map((row) => (
              <tr key={row.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">{new Date(row.committed_at).toLocaleString()}</td>
                <td className="px-3 py-2">{row.file_name}</td>
                <td className="px-3 py-2">{row.service_month.slice(0, 7)}</td>
                <td className="px-3 py-2 text-xs">{row.school_groups.join("; ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DemoFinalizeModal({
  auth,
  roster,
  onClose,
  onSaved,
}: {
  auth: DemoAuthorization;
  roster: DemoRosterStudent[];
  onClose: () => void;
  onSaved: (authNumber: string) => void;
}) {
  const [authNumber, setAuthNumber] = useState("87654321");
  const [rows, setRows] = useState(roster);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-brand-black">Enter authorization (demo)</h3>
        <p className="mt-1 text-sm text-brand-black/65">
          {auth.school_name} · {auth.group_name}. Changes here are not saved — for training only.
        </p>
        <label className="mt-4 block text-sm">
          <span className="font-medium">GVRA authorization number</span>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
            value={authNumber}
            onChange={(e) => setAuthNumber(e.target.value)}
          />
        </label>
        <ul className="mt-4 space-y-2 text-sm">
          {rows.map((row, i) => (
            <li key={row.id} className="flex flex-wrap gap-2 rounded-lg bg-neutral-50 p-2">
              <input
                className="min-w-[8rem] flex-1 rounded border border-neutral-200 px-2 py-1 text-xs"
                value={row.fullName}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...row, fullName: e.target.value };
                  setRows(next);
                }}
              />
              <span className="text-xs text-brand-black/55">PID {row.participantId}</span>
              <span className="text-xs">{row.unitsApproved} units</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-lg px-4 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white"
            onClick={() => {
              onSaved(authNumber.trim());
              onClose();
            }}
          >
            Release roster (demo)
          </button>
        </div>
      </div>
    </div>
  );
}

export function PreEtsDemoAuthorizationsPanel({
  step,
  role,
  onAdvanceStep,
}: {
  step: number;
  role: PreEtsDemoRole;
  onAdvanceStep?: (next: number) => void;
}) {
  const [localStep, setLocalStep] = useState<number | null>(null);
  const effectiveStep = localStep ?? step;
  const snapshot = useMemo(() => getDemoSnapshot(effectiveStep), [effectiveStep]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<DemoAuthorization | null>(null);
  const canFinalize = role === "accounts";

  const auths = snapshot.authorizations.filter((a) => {
    if (role === "field") {
      return a.released;
    }
    return true;
  });

  function handleFinalizeSaved() {
    setLocalStep(3);
    onAdvanceStep?.(3);
  }

  return panelShell(
    "Authorizations & rosters",
    role === "field"
      ? "TS/TI only see schools after Accounts enters the GVRA authorization number."
      : "Pending rosters appear after worksheet upload. Accounts releases one school/group at a time.",
    <>
      <div className="overflow-x-auto rounded-lg border border-neutral-100">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">Auth #</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">School / Group</th>
              <th className="px-3 py-2">Instructor</th>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {auths.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-brand-black/55">
                  No released rosters at this training step.
                </td>
              </tr>
            ) : (
              auths.map((a) => (
                <Fragment key={a.id}>
                  <tr className="border-t border-neutral-100">
                    <td className="px-3 py-2 font-mono text-xs">{a.auth_number ?? "pending"}</td>
                    <td className="px-3 py-2 capitalize">{a.auth_type}</td>
                    <td className="px-3 py-2">
                      {a.school_name} · {a.group_name}
                    </td>
                    <td className="px-3 py-2 text-xs">{a.instructor_name}</td>
                    <td className="px-3 py-2">{a.service_month.slice(0, 7)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-xs text-brand-green hover:underline"
                        onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                      >
                        {expandedId === a.id ? "Hide roster" : "View roster"}
                      </button>
                      {canFinalize && !a.auth_number ? (
                        <>
                          {" · "}
                          <button
                            type="button"
                            className="text-xs font-semibold text-brand-gold hover:underline"
                            onClick={() => setFinalizeTarget(a)}
                          >
                            Enter authorization
                          </button>
                        </>
                      ) : null}
                      {a.auth_number ? (
                        <span className="ml-1 text-xs text-brand-black/50">· PDF (demo)</span>
                      ) : null}
                    </td>
                  </tr>
                  {expandedId === a.id ? (
                    <tr className="bg-neutral-50/80">
                      <td colSpan={6} className="px-3 py-3">
                        <ul className="space-y-1 text-xs">
                          {(snapshot.rosters[a.id] ?? []).map((r) => (
                            <li key={r.id}>
                              {r.fullName} · PID {r.participantId} · {r.unitsApproved} units
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      {finalizeTarget ? (
        <DemoFinalizeModal
          auth={finalizeTarget}
          roster={snapshot.rosters[finalizeTarget.id] ?? []}
          onClose={() => setFinalizeTarget(null)}
          onSaved={() => handleFinalizeSaved()}
        />
      ) : null}
    </>
  );
}

export function PreEtsDemoPipelinePanel({ step }: { step: number }) {
  const snapshot = useMemo(() => getDemoSnapshot(step), [step]);

  return panelShell(
    "Schools & groups",
    "Pipeline status for the service month: awaiting spreadsheet → pending authorization → roster submitted.",
    <>
      <p className="text-xs text-brand-black/55">
        District {DEMO_DISTRICT} · Month {DEMO_SERVICE_MONTH.slice(0, 7)}
      </p>
      <div className="overflow-x-auto rounded-lg border border-neutral-100">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">School</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Students</th>
              <th className="px-3 py-2">Auth #</th>
              <th className="px-3 py-2">TS</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.pipeline.map((row) => (
              <tr key={`${row.schoolName}-${row.groupName}`} className="border-t border-neutral-100">
                <td className="px-3 py-2">{row.schoolName}</td>
                <td className="px-3 py-2">{row.groupName}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.status === "roster_submitted"
                        ? "bg-brand-green/15 text-brand-green"
                        : row.status === "pending_authorization"
                          ? "bg-amber-100 text-amber-950"
                          : "bg-neutral-100 text-brand-black/70"
                    }`}
                  >
                    {row.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-3 py-2">{row.studentCount || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.authNumber ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{row.instructorName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function PreEtsDemoSessionsPanel({ step }: { step: number }) {
  const snapshot = useMemo(() => getDemoSnapshot(step), [step]);

  if (snapshot.sessions.length === 0) {
    return null;
  }

  return panelShell(
    "Sessions & reports",
    "Schedule Pre-ETS sessions and upload signed rosters / CARs after delivery.",
    <>
      <div className="overflow-x-auto rounded-lg border border-neutral-100">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">School</th>
              <th className="px-3 py-2">Auth #</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Documentation</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.sessions.map((s) => (
              <tr key={s.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">{s.session_date}</td>
                <td className="px-3 py-2">{s.school_name}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.auth_number}</td>
                <td className="px-3 py-2 capitalize">{s.status}</td>
                <td className="px-3 py-2 text-xs text-brand-black/60">
                  Roster {s.has_signed_roster ? "uploaded" : "needed"} · CAR{" "}
                  {s.has_car ? "submitted" : "pending"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function PreEtsDemoNotificationsPanel({ step }: { step: number }) {
  const snapshot = useMemo(() => getDemoSnapshot(step), [step]);
  if (snapshot.notifications.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase text-brand-black/55">Sample notifications</p>
      {snapshot.notifications.map((n) => (
        <div
          key={n.id}
          className="rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-brand-black">{n.title}</p>
            <DemoBadge />
          </div>
          <p className="mt-1 text-brand-black/75">{n.body}</p>
          <p className="mt-2 text-xs text-brand-black/45">
            {new Date(n.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
