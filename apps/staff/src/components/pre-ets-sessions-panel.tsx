"use client";

import { useCallback, useEffect, useState } from "react";
import { SignaturePad } from "@/components/signature-pad";

type Session = {
  id: string;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  instructor_name: string | null;
  primary_instructor_user_id?: string | null;
  co_instructor_user_id?: string | null;
  signed_roster_drive_file_id: string | null;
  signed_roster_drive_file_name?: string | null;
  signed_roster_uploaded_at: string | null;
  documentation_completed_at?: string | null;
  pre_ets_schools: { name: string } | null;
  pre_ets_authorizations: {
    auth_number: string | null;
    service_code: string;
    service_label: string | null;
  } | null;
  pre_ets_activity_reports?:
    | { status: string; late_submitted?: boolean }
    | { status: string; late_submitted?: boolean }[]
    | null;
};

type ActivityReport = {
  id: string;
  session_date: string | null;
  lesson_topic: string | null;
  learning_objective: string | null;
  lesson_structure: string | null;
  participant_count: number | null;
  students_on_time: boolean | null;
  students_engaged: boolean | null;
  students_participated: boolean | null;
  students_disruptive: boolean | null;
  faculty_present: boolean | null;
  additional_notes: string | null;
  signature_data: string | null;
  signed_date: string | null;
  status: string;
};

type AttendanceRow = {
  id: string;
  present: boolean;
  signed_on_roster: boolean;
  pre_ets_students: { participant_id: string | null; full_name: string } | null;
};

const CAR_QUESTIONS: {
  key: keyof Pick<
    ActivityReport,
    | "students_on_time"
    | "students_engaged"
    | "students_participated"
    | "students_disruptive"
    | "faculty_present"
  >;
  label: string;
}[] = [
  { key: "students_on_time", label: "Did students arrive on time for the session?" },
  { key: "students_engaged", label: "Were present students engaged in Pre-ETS activities?" },
  { key: "students_participated", label: "Did all present students participate in activities?" },
  { key: "students_disruptive", label: "Were there disruptive behaviors that affected instruction?" },
  { key: "faculty_present", label: "Was school faculty or designated staff present as required?" },
];

function activityReportStatus(session: Session): string | null {
  const raw = session.pre_ets_activity_reports;
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0]?.status ?? null;
  return raw.status ?? null;
}

export function PreEtsSessionsPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [authorizations, setAuthorizations] = useState<
    { id: string; auth_number: string | null; auth_type: string }[]
  >([]);
  const [newAuthId, setNewAuthId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<ActivityReport | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [sessionDate, setSessionDate] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canSupervise, setCanSupervise] = useState(false);
  const [staffOptions, setStaffOptions] = useState<{ id: string; full_name: string | null }[]>([]);
  const [coInstructorId, setCoInstructorId] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/pre-ets/sessions");
    const data = (await res.json()) as { sessions?: Session[] };
    if (res.ok) setSessions(data.sessions ?? []);

    const authRes = await fetch("/api/pre-ets/authorizations");
    const authData = (await authRes.json()) as {
      authorizations?: { id: string; auth_number: string | null; auth_type: string }[];
    };
    if (authRes.ok) {
      setAuthorizations(authData.authorizations ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
    void (async () => {
      const accessRes = await fetch("/api/pre-ets/access");
      const accessData = (await accessRes.json()) as { access?: { canSupervise?: boolean } };
      if (accessRes.ok && accessData.access?.canSupervise) {
        setCanSupervise(true);
        const staffRes = await fetch("/api/pre-ets/instructors");
        const staffData = (await staffRes.json()) as {
          staff?: { id: string; full_name: string | null }[];
        };
        if (staffRes.ok) setStaffOptions(staffData.staff ?? []);
      }
    })();
  }, [load]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  const isEditable = selected?.status === "scheduled";

  async function loadSessionDetails(sessionId: string) {
    setSelectedId(sessionId);
    setMessage(null);
    setError(null);

    const session = sessions.find((s) => s.id === sessionId);
    setCoInstructorId(session?.co_instructor_user_id ?? "");

    const reportRes = await fetch(`/api/pre-ets/sessions/${sessionId}/activity-report`);
    const reportData = (await reportRes.json()) as { report?: ActivityReport };
    if (reportRes.ok && reportData.report) {
      const r = reportData.report;
      setReport({
        ...r,
        participant_count: r.participant_count ?? null,
        signature_data: r.signature_data ?? null,
        signed_date:
          r.signed_date ??
          (r.status === "draft" ? new Date().toISOString().slice(0, 10) : null),
      });
      setSessionDate(r.session_date ?? "");
    } else {
      setReport(null);
      setSessionDate("");
    }

    const attRes = await fetch(`/api/pre-ets/sessions/${sessionId}/attendance`);
    const attData = (await attRes.json()) as { attendance?: AttendanceRow[] };
    if (attRes.ok) setAttendance(attData.attendance ?? []);
  }

  async function saveCoInstructor() {
    if (!selectedId) return;
    setError(null);
    const res = await fetch(`/api/pre-ets/sessions/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coInstructorUserId: coInstructorId || null }),
    });
    if (!res.ok) {
      setError("Could not update co-instructor.");
      return;
    }
    setMessage("Co-instructor updated.");
    void load();
  }

  async function saveReport(submit: boolean) {
    if (!report) return;
    setError(null);

    if (submit) {
      if (!report.signature_data?.startsWith("data:image/")) {
        setError("Draw your signature before submitting the Class Activity Report.");
        return;
      }
      if (!report.signed_date) {
        setError("Enter the signed date before submitting the Class Activity Report.");
        return;
      }
    }

    const res = await fetch(`/api/pre-ets/activity-reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_date: sessionDate || null,
        lesson_topic: report.lesson_topic,
        learning_objective: report.learning_objective,
        lesson_structure: report.lesson_structure,
        participant_count: report.participant_count,
        students_on_time: report.students_on_time,
        students_engaged: report.students_engaged,
        students_participated: report.students_participated,
        students_disruptive: report.students_disruptive,
        faculty_present: report.faculty_present,
        additional_notes: report.additional_notes,
        signature_data: report.signature_data,
        signed_date: report.signed_date,
        status: submit ? "submitted" : "draft",
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error || "Could not save activity report.");
      return;
    }
    setMessage(submit ? "Lesson Activity Report submitted." : "CAR draft saved.");
    void load();
    if (selectedId) void loadSessionDetails(selectedId);
  }

  async function saveAttendance() {
    if (!selectedId) return;
    setError(null);
    const res = await fetch(`/api/pre-ets/sessions/${selectedId}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: attendance.map((row) => ({
          id: row.id,
          present: row.present,
          signedOnRoster: row.present,
        })),
      }),
    });
    if (!res.ok) {
      setError("Could not save attendance.");
      return;
    }
    setMessage("Attendance saved. Present = signed on paper roster.");
    void load();
  }

  async function uploadSignedRoster(file: File) {
    if (!selectedId) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/pre-ets/sessions/${selectedId}/signed-roster`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setMessage("Signed roster uploaded to Google Drive.");
      void load();
      void loadSessionDetails(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function rescheduleSession() {
    if (!selectedId || !cancelReason.trim() || !rescheduleDate) {
      setError("Reason and replacement session date are required to reschedule.");
      return;
    }
    setError(null);
    const res = await fetch(`/api/pre-ets/sessions/${selectedId}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: cancelReason.trim(),
        newSessionDate: rescheduleDate,
      }),
    });
    const data = (await res.json()) as { error?: string; newSessionId?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not reschedule session.");
      return;
    }
    setMessage("Session rescheduled. Replacement session created.");
    setCancelReason("");
    setRescheduleDate("");
    void load();
    if (data.newSessionId) void loadSessionDetails(data.newSessionId);
  }

  async function cancelOrReschedule(status: "cancelled") {
    if (!selectedId || !cancelReason.trim()) {
      setError("Reason is required to cancel or reschedule.");
      return;
    }
    setError(null);
    const res = await fetch(`/api/pre-ets/sessions/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, cancelledReason: cancelReason.trim() }),
    });
    if (!res.ok) {
      setError("Could not update session.");
      return;
    }
    setMessage(`Session marked ${status}. Compliance gap cleared.`);
    setCancelReason("");
    void load();
    void loadSessionDetails(selectedId);
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

  function setCarAnswer(
    key: (typeof CAR_QUESTIONS)[number]["key"],
    value: boolean
  ) {
    if (!report) return;
    setReport({ ...report, [key]: value });
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-black">Sessions</h2>
          <p className="mt-1 text-sm text-brand-black/65">
            Schedule sessions, upload signed rosters to Drive, mark attendance, and submit Lesson
            Activity Reports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <select
            className="rounded-lg border border-neutral-300 px-2 py-1.5"
            value={newAuthId}
            onChange={(e) => setNewAuthId(e.target.value)}
          >
            <option value="">Authorization…</option>
            {authorizations.map((a) => (
              <option key={a.id} value={a.id}>
                [{a.auth_type}] {a.auth_number ?? a.id.slice(0, 8)}
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
                  onClick={() => void loadSessionDetails(s.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedId === s.id
                      ? "border-brand-green bg-brand-green/5"
                      : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <p className="font-medium">{s.pre_ets_schools?.name ?? "School"}</p>
                  <p className="text-brand-black/60">
                    {s.session_date ?? "Date TBD"} · {s.status}
                    {s.signed_roster_drive_file_id ? " · roster uploaded" : ""}
                    {activityReportStatus(s) === "submitted" ||
                    activityReportStatus(s) === "late_submitted"
                      ? " · CAR submitted"
                      : ""}
                    {s.documentation_completed_at ? " · complete" : ""}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="space-y-4">
        {!selected ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-brand-black/55">
            Select a session to manage roster upload, attendance, and CAR.
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="font-semibold text-brand-black">
                {selected.pre_ets_schools?.name} · {selected.session_date ?? "Date TBD"}
              </h3>
              <p className="mt-1 text-xs text-brand-black/60">
                Auth {selected.pre_ets_authorizations?.auth_number ?? "—"} · {selected.status}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-brand-gold px-3 py-1.5 text-sm font-semibold text-brand-gold"
                  onClick={() => printRoster(selected.id)}
                >
                  Print roster PDF
                </button>
                {report ? (
                  <a
                    href={`/api/pre-ets/sessions/${selected.id}/car-pdf`}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-brand-black/80"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download CAR PDF
                  </a>
                ) : null}
              </div>

              {canSupervise ? (
                <div className="mt-4 space-y-2 text-sm">
                  <p className="font-medium">Co-instructor</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="rounded-lg border border-neutral-300 px-2 py-1.5"
                      value={coInstructorId}
                      onChange={(e) => setCoInstructorId(e.target.value)}
                    >
                      <option value="">None</option>
                      {staffOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name ?? s.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium"
                      onClick={() => void saveCoInstructor()}
                    >
                      Save co-instructor
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 space-y-2 text-sm">
                <p className="font-medium">Signed roster PDF (Google Drive)</p>
                {selected.signed_roster_drive_file_name || selected.signed_roster_drive_file_id ? (
                  <p className="text-brand-black/60">
                    Uploaded
                    {selected.signed_roster_drive_file_name
                      ? `: ${selected.signed_roster_drive_file_name}`
                      : ""}
                  </p>
                ) : (
                  <p className="text-brand-black/55">No signed roster on file yet.</p>
                )}
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={!isEditable || uploading}
                  className="block w-full text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadSignedRoster(file);
                  }}
                />
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <p className="font-medium">Attendance (present = signed on paper roster)</p>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-neutral-200 divide-y">
                  {attendance.length === 0 ? (
                    <p className="p-3 text-brand-black/55">No students on roster for this authorization.</p>
                  ) : (
                    attendance.map((row, idx) => (
                      <label
                        key={row.id}
                        className="flex cursor-pointer items-center gap-2 p-2 hover:bg-neutral-50"
                      >
                        <input
                          type="checkbox"
                          checked={row.present}
                          disabled={!isEditable}
                          onChange={(e) => {
                            const present = e.target.checked;
                            setAttendance((rows) => {
                              const next = [...rows];
                              next[idx] = { ...row, present, signed_on_roster: present };
                              return next;
                            });
                          }}
                        />
                        <span className="flex-1">{row.pre_ets_students?.full_name ?? "Student"}</span>
                        {row.pre_ets_students?.participant_id ? (
                          <span className="text-xs text-brand-black/50">
                            {row.pre_ets_students.participant_id}
                          </span>
                        ) : null}
                      </label>
                    ))
                  )}
                </div>
                {isEditable && attendance.length > 0 ? (
                  <button
                    type="button"
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium"
                    onClick={() => void saveAttendance()}
                  >
                    Save attendance
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="font-semibold text-brand-black">Lesson Activity Report</h3>
              {!report ? (
                <p className="mt-2 text-sm text-brand-black/55">No report draft for this session.</p>
              ) : (
                <div className="mt-4 space-y-3 text-sm">
                  <label className="block">
                    <span className="font-medium">Session date</span>
                    <input
                      type="date"
                      className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                      value={sessionDate}
                      disabled={!isEditable}
                      onChange={(e) => setSessionDate(e.target.value)}
                    />
                  </label>

                  <label className="block">
                    <span className="font-medium">Lesson topic</span>
                    <input
                      className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                      disabled={!isEditable}
                      value={report.lesson_topic ?? ""}
                      onChange={(e) => setReport({ ...report, lesson_topic: e.target.value })}
                    />
                  </label>

                  <label className="block">
                    <span className="font-medium">Learning objective</span>
                    <textarea
                      className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                      rows={2}
                      disabled={!isEditable}
                      value={report.learning_objective ?? ""}
                      onChange={(e) => setReport({ ...report, learning_objective: e.target.value })}
                    />
                  </label>

                  <label className="block">
                    <span className="font-medium">Lesson structure</span>
                    <textarea
                      className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                      rows={2}
                      disabled={!isEditable}
                      value={report.lesson_structure ?? ""}
                      onChange={(e) => setReport({ ...report, lesson_structure: e.target.value })}
                    />
                  </label>

                  <label className="block">
                    <span className="font-medium">Number of participants</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="mt-1 block w-full max-w-[12rem] rounded-lg border border-neutral-300 px-3 py-2"
                      disabled={!isEditable}
                      value={report.participant_count ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        setReport({
                          ...report,
                          participant_count: raw === "" ? null : Math.max(0, Number.parseInt(raw, 10) || 0),
                        });
                      }}
                    />
                  </label>

                  {CAR_QUESTIONS.map((q) => (
                    <fieldset key={q.key} className="space-y-1.5" disabled={!isEditable}>
                      <legend className="text-sm text-brand-black">{q.label}</legend>
                      <div className="flex flex-wrap gap-4 pl-0.5">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-neutral-400"
                            checked={report[q.key] === true}
                            onChange={() => setCarAnswer(q.key, true)}
                          />
                          Yes
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-neutral-400"
                            checked={report[q.key] === false}
                            onChange={() => setCarAnswer(q.key, false)}
                          />
                          No
                        </label>
                      </div>
                    </fieldset>
                  ))}

                  <label className="block">
                    <span className="font-medium">Additional Note(s)</span>
                    <textarea
                      className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                      rows={2}
                      disabled={!isEditable}
                      value={report.additional_notes ?? ""}
                      onChange={(e) => setReport({ ...report, additional_notes: e.target.value })}
                      placeholder="Optional — left blank on the PDF when empty"
                    />
                  </label>

                  <label className="block">
                    <span className="font-medium">Signed date</span>
                    <input
                      type="date"
                      className="mt-1 block w-full max-w-[14rem] rounded-lg border border-neutral-300 px-3 py-2"
                      disabled={!isEditable}
                      value={report.signed_date ?? ""}
                      onChange={(e) =>
                        setReport({ ...report, signed_date: e.target.value || null })
                      }
                    />
                  </label>

                  <SignaturePad
                    label="Instructor signature"
                    disabled={!isEditable}
                    value={report.signature_data}
                    onChange={(dataUrl) =>
                      setReport({ ...report, signature_data: dataUrl || null })
                    }
                  />

                  {isEditable ? (
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
                        Submit CAR
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-brand-black/60">
                      Report status: {report.status}
                      {report.status === "late_submitted" ? " (late)" : ""}
                    </p>
                  )}
                </div>
              )}
            </div>

            {isEditable ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
                <h3 className="font-semibold text-brand-black">Cancel / reschedule</h3>
                <p className="mt-1 text-brand-black/60">
                  Cancelling or rescheduling clears compliance requirements for this session.
                  Rescheduling creates a linked replacement session.
                </p>
                <textarea
                  className="mt-3 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                  rows={2}
                  placeholder="Reason (required)"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <label className="mt-3 block">
                  <span className="font-medium">Replacement session date</span>
                  <input
                    type="date"
                    className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                  />
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
                    onClick={() => void cancelOrReschedule("cancelled")}
                  >
                    Cancel session
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium"
                    onClick={() => void rescheduleSession()}
                  >
                    Reschedule with replacement
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}

        {message ? <p className="text-xs text-brand-green">{message}</p> : null}
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
      </div>
    </section>
  );
}
