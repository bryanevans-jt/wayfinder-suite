"use client";

import {
  PRE_ETS_DEMO_SESSIONS_BLURB,
  PreEtsDemoSessionsDetail,
} from "@/components/pre-ets-demo-sessions-detail";
import { PreEtsServiceCodeDisplay } from "@/components/pre-ets-service-code-display";
import {
  DEMO_DISTRICT,
  DEMO_SERVICE_MONTH,
  type DemoAuthorization,
  type DemoRosterStudent,
  type DemoSnapshot,
  getDemoSnapshot,
} from "@/lib/pre-ets-demo-mock-data";
import type { PreEtsDemoRole } from "@/lib/pre-ets-demo-scenario";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

type PipelineStatus = "awaiting_spreadsheet" | "pending_authorization" | "roster_submitted";

function statusBadgeClass(status: PipelineStatus): string {
  switch (status) {
    case "awaiting_spreadsheet":
      return "bg-neutral-100 text-brand-black/75";
    case "pending_authorization":
      return "bg-amber-100 text-amber-950";
    case "roster_submitted":
      return "bg-brand-green/15 text-brand-green";
  }
}

function statusLabel(status: PipelineStatus): string {
  switch (status) {
    case "awaiting_spreadsheet":
      return "Awaiting spreadsheet";
    case "pending_authorization":
      return "Pending authorization";
    case "roster_submitted":
      return "Roster submitted";
  }
}

type AuthTab = "all" | "group" | "individual" | "pending";

type DemoDataOverride = Pick<
  DemoSnapshot,
  "authorizations" | "rosters" | "pipeline" | "worksheetImports" | "sessions"
>;

function DemoFinalizeModal({
  auth,
  roster,
  canEditServiceCode,
  onClose,
  onSaved,
}: {
  auth: DemoAuthorization;
  roster: DemoRosterStudent[];
  canEditServiceCode?: boolean;
  onClose: () => void;
  onSaved: (authNumber: string) => void;
}) {
  const [authNumber, setAuthNumber] = useState("87654321");
  const [serviceCode, setServiceCode] = useState(auth.service_code);
  const [serviceLabel, setServiceLabel] = useState(auth.service_label);
  const [rows, setRows] = useState(
    roster.map((r) => ({
      participantId: r.participantId,
      fullName: r.fullName,
      unitsApproved: r.unitsApproved,
    }))
  );

  function updateRow(index: number, patch: Partial<(typeof rows)[number]>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { participantId: "", fullName: "", unitsApproved: 0 }]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-brand-black">Enter authorization</h2>
        <p className="mt-1 text-sm text-brand-black/70">
          {auth.school_name}
          {auth.group_name ? ` · ${auth.group_name}` : ""}
        </p>
        <p className="mt-2 text-xs text-brand-black/60">
          Add or remove students as needed. In production, saving finalizes this roster and notifies
          the assigned TS/TI and supervisor. This demo does not save.
        </p>

        <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
          <span className="font-medium text-brand-black">Service code</span>
          {canEditServiceCode ? (
            <input
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
              value={serviceCode}
              onChange={(e) => setServiceCode(e.target.value)}
            />
          ) : (
            <p className="mt-1">
              <PreEtsServiceCodeDisplay code={serviceCode} label={serviceLabel} prominent />
            </p>
          )}
          {!canEditServiceCode ? (
            <p className="mt-1 text-xs text-brand-black/55">
              Only Accounts Specialist, Admin, or Super Admin can change the service code.
            </p>
          ) : null}
        </div>

        <label className="mt-4 block text-sm">
          <span className="font-medium">GVRA authorization number</span>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
            value={authNumber}
            onChange={(e) => setAuthNumber(e.target.value)}
          />
        </label>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Roster students</p>
            <button type="button" className="text-sm text-brand-green hover:underline" onClick={addRow}>
              Add student
            </button>
          </div>
          {rows.map((row, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg border border-neutral-200 p-3 sm:grid-cols-[1fr_1fr_80px_auto]"
            >
              <input
                placeholder="Participant ID"
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
                value={row.participantId}
                onChange={(e) => updateRow(index, { participantId: e.target.value })}
              />
              <input
                placeholder="Student name"
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
                value={row.fullName}
                onChange={(e) => updateRow(index, { fullName: e.target.value })}
              />
              <input
                type="number"
                min={0}
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
                value={row.unitsApproved}
                onChange={(e) => updateRow(index, { unitsApproved: Number(e.target.value) || 0 })}
              />
              <button
                type="button"
                className="text-sm text-red-700 hover:underline"
                onClick={() => removeRow(index)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={rows.length === 0 || !authNumber.trim()}
            onClick={() => {
              onSaved(authNumber.trim());
              onClose();
            }}
          >
            Finalize roster
          </button>
        </div>
      </div>
    </div>
  );
}

export function PreEtsDemoWorksheetPanel({ step }: { step: number }) {
  const snapshot = useMemo(() => getDemoSnapshot(step), [step]);
  const supervisorDescription =
    "Upload your monthly district CSV before GVRA authorization numbers are available. Pending rosters are created immediately; you can re-upload the same month to add schools or students.";

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">District worksheet import</h2>
        <p className="mt-1 text-sm text-brand-black/65">{supervisorDescription}</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
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

      <p className="text-sm text-brand-black/70">
        Sample: District {DEMO_DISTRICT}, {DEMO_SERVICE_MONTH.slice(0, 7)}, Valdosta
        {step >= 5 ? " + Lowndes on re-upload" : ""}.
      </p>

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">Uploaded</th>
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">Phase</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.worksheetImports.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-brand-black/55">
                  No worksheet imports yet.
                </td>
              </tr>
            ) : (
              snapshot.worksheetImports.map((row) => (
                <tr key={row.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{new Date(row.committed_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{row.file_name ?? "—"}</td>
                  <td className="px-3 py-2">{row.service_month.slice(0, 7)}</td>
                  <td className="px-3 py-2">{row.phase}</td>
                  <td className="px-3 py-2">{row.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PreEtsDemoAuthorizationsPanel({
  step,
  role,
  onAdvanceStep,
  dataOverride,
  defaultAuthTab,
}: {
  step: number;
  role: PreEtsDemoRole;
  onAdvanceStep?: (next: number) => void;
  dataOverride?: DemoDataOverride;
  defaultAuthTab?: AuthTab;
}) {
  const [localStep, setLocalStep] = useState<number | null>(null);
  const effectiveStep = localStep ?? step;
  const snapshot = useMemo(() => {
    if (dataOverride) {
      return { ...getDemoSnapshot(effectiveStep), ...dataOverride };
    }
    return getDemoSnapshot(effectiveStep);
  }, [dataOverride, effectiveStep]);
  const [month] = useState(DEMO_SERVICE_MONTH.slice(0, 7));
  const [tab, setTab] = useState<AuthTab>(defaultAuthTab ?? "all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<DemoAuthorization | null>(null);
  const canFinalize = role === "accounts";
  const canEditServiceCode = role === "accounts";

  const auths = snapshot.authorizations.filter((a) => {
    if (role === "field") {
      return a.released;
    }
    if (tab === "pending") return !a.auth_number;
    if (tab === "group") return a.auth_type === "group" || (a.auth_type === "pending" && !a.auth_number);
    if (tab === "individual") return a.auth_type === "individual";
    return true;
  });

  const authTabs: { id: AuthTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "group", label: "Group" },
    { id: "individual", label: "Individual" },
    { id: "pending", label: "Pending" },
  ];

  function handleFinalizeSaved() {
    setLocalStep(3);
    onAdvanceStep?.(3);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-black">Authorizations &amp; rosters</h2>
          <p className="mt-1 text-sm text-brand-black/65">
            {role === "field"
              ? "Released rosters only — schedule sessions from Sessions & reports."
              : "Pending rosters appear after supervisors upload district worksheets. Enter authorization numbers to release rosters to TS/TI one school at a time."}
          </p>
        </div>
        <label className="text-sm">
          <span className="font-medium">Filter month</span>
          <input
            type="month"
            readOnly
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2"
            value={month}
          />
        </label>
      </div>

      <nav className="flex flex-wrap gap-2">
        {authTabs.map((t) => (
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

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">Auth #</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">School / Group</th>
              <th className="px-3 py-2">Service code</th>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {auths.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-brand-black/55">
                  {role === "field"
                    ? "No released rosters at this training step."
                    : "No authorizations in this view. Commit a district worksheet import first."}
                </td>
              </tr>
            ) : (
              auths.map((a) => (
                <Fragment key={a.id}>
                  <tr className="border-t border-neutral-100">
                    <td className="px-3 py-2 font-mono text-xs">{a.auth_number ?? "pending"}</td>
                    <td className="px-3 py-2 capitalize">{a.auth_type}</td>
                    <td className="px-3 py-2">
                      {a.school_name}
                      {a.group_name ? ` · ${a.group_name}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      <PreEtsServiceCodeDisplay code={a.service_code} label={a.service_label} />
                    </td>
                    <td className="px-3 py-2">{a.service_month.slice(0, 7)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-xs text-brand-green hover:underline"
                          onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                        >
                          {expandedId === a.id ? "Hide roster" : "View roster"}
                        </button>
                        {canFinalize && a.auth_type === "pending" && !a.auth_number ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-brand-gold hover:underline"
                            onClick={() => setFinalizeTarget(a)}
                          >
                            Enter authorization
                          </button>
                        ) : null}
                        {a.auth_number ? (
                          <span className="text-xs text-brand-green">Print PDF</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {expandedId === a.id ? (
                    <tr className="border-t border-neutral-50 bg-neutral-50/50">
                      <td colSpan={6} className="px-3 py-3">
                        <p className="mb-2 text-xs text-brand-black/80">
                          <span className="font-semibold">Service code for this roster: </span>
                          <PreEtsServiceCodeDisplay
                            code={a.service_code}
                            label={a.service_label}
                            prominent
                          />
                        </p>
                        <ul className="space-y-1 text-xs text-brand-black/75">
                          {(snapshot.rosters[a.id] ?? []).map((r) => (
                            <li key={r.id}>
                              {r.fullName} · PID {r.participantId} · {r.unitsApproved} units approved
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
          canEditServiceCode={canEditServiceCode}
          onClose={() => setFinalizeTarget(null)}
          onSaved={() => handleFinalizeSaved()}
        />
      ) : null}
    </section>
  );
}

export function PreEtsDemoPipelinePanel({ step, dataOverride }: { step: number; dataOverride?: DemoDataOverride }) {
  const snapshot = useMemo(() => {
    if (dataOverride?.pipeline) {
      return { ...getDemoSnapshot(step), pipeline: dataOverride.pipeline };
    }
    return getDemoSnapshot(step);
  }, [dataOverride, step]);
  const [month] = useState(DEMO_SERVICE_MONTH.slice(0, 7));
  const rows = snapshot.pipeline;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Schools &amp; groups</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Track each school or group through Awaiting spreadsheet → Pending authorization → Roster
          submitted. Search and filter to find a site quickly.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
        <label className="text-sm">
          <span className="font-medium">Service month</span>
          <input
            type="month"
            readOnly
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2"
            value={month}
          />
        </label>
        <label className="min-w-[12rem] flex-1 text-sm">
          <span className="font-medium">Search</span>
          <input
            type="search"
            readOnly
            placeholder="School, group, auth #, instructor…"
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Status</span>
          <select className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2" defaultValue="all">
            <option value="all">All statuses</option>
            <option value="awaiting_spreadsheet">Awaiting spreadsheet</option>
            <option value="pending_authorization">Pending authorization</option>
            <option value="roster_submitted">Roster submitted</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium">Per page</span>
          <select className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2" defaultValue="25">
            <option value="25">25</option>
          </select>
        </label>
      </div>

      <p className="text-sm text-brand-black/60">
        Showing 1–{rows.length} of {rows.length}
      </p>

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">School / group</th>
              <th className="px-3 py-2">Students</th>
              <th className="px-3 py-2">Auth #</th>
              <th className="px-3 py-2">Service code</th>
              <th className="px-3 py-2">Instructor</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.schoolName}-${row.groupName}`}
                className="border-t border-neutral-100"
              >
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-brand-black">{row.groupName}</p>
                  {row.groupName !== row.schoolName ? (
                    <p className="text-xs text-brand-black/55">{row.schoolName}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2">{row.studentCount || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.authNumber ?? "—"}</td>
                <td className="px-3 py-2">
                  <PreEtsServiceCodeDisplay code={row.serviceCode} />
                </td>
                <td className="px-3 py-2 text-xs text-brand-black/75">{row.instructorName ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-brand-black/45">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PreEtsDemoSessionsPanel({ step, dataOverride }: { step: number; dataOverride?: DemoDataOverride }) {
  const snapshot = useMemo(() => {
    if (dataOverride?.sessions) {
      return { ...getDemoSnapshot(step), sessions: dataOverride.sessions };
    }
    return getDemoSnapshot(step);
  }, [dataOverride, step]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessions = snapshot.sessions;
  const selected = sessions.find((s) => s.id === selectedId) ?? sessions[0] ?? null;

  const releasedAuths = snapshot.authorizations.filter(
    (a) => a.released && a.auth_number
  );

  const rosterStudents =
    selected && snapshot.rosters["demo-auth-valdosta"]
      ? snapshot.rosters["demo-auth-valdosta"]
      : [];

  if (sessions.length === 0) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-black">Sessions</h2>
          <p className="mt-1 text-sm text-brand-black/65">{PRE_ETS_DEMO_SESSIONS_BLURB}</p>
        </div>
        <p className="text-sm text-brand-black/55">No sessions scheduled yet.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-black">Sessions</h2>
          <p className="mt-1 text-sm text-brand-black/65">{PRE_ETS_DEMO_SESSIONS_BLURB}</p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <select
            className="rounded-lg border border-neutral-300 px-2 py-1.5"
            disabled
            defaultValue={releasedAuths[0]?.id ?? ""}
          >
            <option value="">Authorization…</option>
            {releasedAuths.map((a) => (
              <option key={a.id} value={a.id}>
                [{a.auth_type}] {a.auth_number}
              </option>
            ))}
          </select>
          <input type="date" className="rounded-lg border border-neutral-300 px-2 py-1.5" disabled />
          <span className="cursor-not-allowed rounded-lg bg-brand-gold/40 px-3 py-1.5 text-sm font-semibold text-white/90">
            Add session
          </span>
        </div>
        <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  selected?.id === s.id
                    ? "border-brand-green bg-brand-green/5"
                    : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                <p className="font-medium">{s.school_name}</p>
                <p className="text-brand-black/60">
                  {s.session_date} · {s.status}
                  {s.has_signed_roster ? " · roster uploaded" : ""}
                  {s.has_car ? " · CAR submitted" : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        {!selected ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-brand-black/55">
            Select a session to manage roster upload, attendance, and CAR.
          </div>
        ) : (
          <PreEtsDemoSessionsDetail
            mode="preview"
            session={selected}
            rosterStudents={rosterStudents}
          />
        )}
      </div>
    </section>
  );
}

export function PreEtsDemoNotificationsPanel({ step }: { step: number }) {
  const snapshot = useMemo(() => getDemoSnapshot(step), [step]);
  if (snapshot.notifications.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase text-brand-black/55">Sample notifications</p>
      {snapshot.notifications.map((n) => (
        <div key={n.id} className="rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm">
          <p className="font-medium text-brand-black">{n.title}</p>
          <p className="mt-1 text-brand-black/75">{n.body}</p>
          <p className="mt-2 text-xs text-brand-black/45">{new Date(n.created_at).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
