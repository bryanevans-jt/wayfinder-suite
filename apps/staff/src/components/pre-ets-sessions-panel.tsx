"use client";

import { useCallback, useEffect, useState } from "react";

type Session = {
  id: string;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  instructor_name: string | null;
  pre_ets_schools: { name: string } | null;
  pre_ets_authorizations: {
    auth_number: string | null;
    service_code: string;
    service_label: string | null;
  } | null;
};

type ActivityReport = {
  id: string;
  session_date: string | null;
  lesson_topic: string | null;
  learning_objective: string | null;
  lesson_structure: string | null;
  students_on_time: boolean | null;
  students_engaged: boolean | null;
  students_participated: boolean | null;
  students_disruptive: boolean | null;
  faculty_present: boolean | null;
  additional_notes: string | null;
  status: string;
};

export function PreEtsSessionsPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [authorizations, setAuthorizations] = useState<{ id: string; auth_number: string | null }[]>(
    []
  );
  const [newAuthId, setNewAuthId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<ActivityReport | null>(null);
  const [sessionDate, setSessionDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/pre-ets/sessions");
    const data = (await res.json()) as { sessions?: Session[] };
    if (res.ok) setSessions(data.sessions ?? []);
    const authRes = await fetch("/api/pre-ets/authorizations");
    const authData = (await authRes.json()) as {
      authorizations?: { id: string; auth_number: string | null; auth_type: string }[];
    };
    if (authRes.ok) {
      setAuthorizations(
        (authData.authorizations ?? []).filter((a) => a.auth_type === "group")
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadReport(sessionId: string) {
    setSelectedId(sessionId);
    const res = await fetch(`/api/pre-ets/sessions/${sessionId}/activity-report`);
    const data = (await res.json()) as { report?: ActivityReport };
    if (res.ok && data.report) {
      setReport(data.report);
      setSessionDate(data.report.session_date ?? "");
    }
  }

  async function saveReport(submit: boolean) {
    if (!report) return;
    const res = await fetch(`/api/pre-ets/activity-reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...report,
        session_date: sessionDate || null,
        status: submit ? "submitted" : "draft",
      }),
    });
    setMessage(res.ok ? (submit ? "Activity report submitted." : "Draft saved.") : "Save failed.");
    if (selectedId) void loadReport(selectedId);
  }

  function printRoster(sessionId: string) {
    const qs = sessionDate ? `?sessionDate=${encodeURIComponent(sessionDate)}` : "";
    window.open(`/api/pre-ets/sessions/${sessionId}/roster-pdf${qs}`, "_blank");
  }

  async function createSession() {
    if (!newAuthId) return;
    const res = await fetch("/api/pre-ets/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorizationId: newAuthId,
        sessionDate: newDate || null,
      }),
    });
    if (res.ok) {
      setNewAuthId("");
      setNewDate("");
      void load();
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-black">Sessions</h2>
          <p className="mt-1 text-sm text-brand-black/65">
            Select a session to draft a Lesson Activity Report or print a blank roster.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <select
            className="rounded-lg border border-neutral-300 px-2 py-1.5"
            value={newAuthId}
            onChange={(e) => setNewAuthId(e.target.value)}
          >
            <option value="">Group authorization…</option>
            {authorizations.map((a) => (
              <option key={a.id} value={a.id}>
                {a.auth_number ?? a.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded-lg border border-neutral-300 px-2 py-1.5"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg bg-brand-gold px-3 py-1.5 text-sm font-semibold text-white"
            onClick={() => void createSession()}
          >
            Add session
          </button>
        </div>
        <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
          {sessions.length === 0 ? (
            <li className="text-sm text-brand-black/55">No sessions scheduled yet.</li>
          ) : (
            sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => void loadReport(s.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedId === s.id
                      ? "border-brand-green bg-brand-green/5"
                      : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <p className="font-medium">{s.pre_ets_schools?.name ?? "School"}</p>
                  <p className="text-brand-black/60">
                    {s.session_date ?? "Date TBD"} · {s.status} · Auth{" "}
                    {s.pre_ets_authorizations?.auth_number ?? "—"}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="font-semibold text-brand-black">Lesson Activity Report</h3>
        {!report ? (
          <p className="mt-2 text-sm text-brand-black/55">Select a session to edit its report draft.</p>
        ) : (
          <div className="mt-4 space-y-3 text-sm">
            <label className="block">
              <span className="font-medium">Session date</span>
              <input
                type="date"
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </label>
            {(
              [
                ["lesson_topic", "Lesson topic"],
                ["learning_objective", "Learning objective"],
                ["lesson_structure", "Lesson structure"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="font-medium">{label}</span>
                <textarea
                  className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                  rows={2}
                  value={report[key] ?? ""}
                  onChange={(e) => setReport({ ...report, [key]: e.target.value })}
                />
              </label>
            ))}
            <label className="block">
              <span className="font-medium">Additional notes</span>
              <textarea
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                rows={2}
                value={report.additional_notes ?? ""}
                onChange={(e) => setReport({ ...report, additional_notes: e.target.value })}
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium"
                onClick={() => void saveReport(false)}
              >
                Save draft
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white"
                onClick={() => void saveReport(true)}
              >
                Submit report
              </button>
              {selectedId ? (
                <button
                  type="button"
                  className="rounded-lg border border-brand-gold px-3 py-1.5 text-sm font-semibold text-brand-gold"
                  onClick={() => printRoster(selectedId)}
                >
                  Print roster PDF
                </button>
              ) : null}
            </div>
            {message ? <p className="text-xs text-brand-black/60">{message}</p> : null}
          </div>
        )}
      </div>
    </section>
  );
}
