"use client";

import { PreEtsDemoAuthorizationsPanel } from "@/components/pre-ets-demo-panels";
import {
  PreEtsDemoActivityPlanPrintSheet,
  PreEtsDemoRosterPrintSheet,
} from "@/components/pre-ets-demo-print-sheets";
import { PreEtsDemoWorkspaceChrome } from "@/components/pre-ets-demo-workspace-chrome";
import { SignaturePad } from "@/components/signature-pad";
import { PreEtsServiceCodeDisplay } from "@/components/pre-ets-service-code-display";
import {
  FIELD_DEMO_AUTH,
  FIELD_DEMO_CAR_QUESTIONS,
  FIELD_DEMO_SESSION,
  FIELD_DEMO_STUDENTS,
  FIELD_DEMO_TRAINING_STEPS,
  type FieldDemoStudent,
} from "@/lib/pre-ets-field-delivery-demo-data";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

type CarDraft = {
  lesson_topic: string;
  learning_objective: string;
  lesson_structure: string;
  participant_count: number | null;
  students_on_time: boolean | null;
  students_engaged: boolean | null;
  students_participated: boolean | null;
  students_disruptive: boolean | null;
  faculty_present: boolean | null;
  additional_notes: string;
  signature_data: string | null;
  signed_date: string;
  status: "draft" | "submitted";
};

type PrintModal = "roster" | "activity-plan" | "filled-car" | null;

type Props = {
  /** Public walkthrough omits dashboard links in header. */
  variant?: "dashboard" | "walkthrough";
};

export function PreEtsFieldDeliveryDemo({ variant = "dashboard" }: Props) {
  const [trainingStep, setTrainingStep] = useState(1);
  const [workspaceTab, setWorkspaceTab] = useState<"authorizations" | "sessions">("sessions");
  const [attendance, setAttendance] = useState(() =>
    FIELD_DEMO_STUDENTS.map((s) => ({
      ...s,
      present: false,
      roster_signature_data: null as string | null,
    }))
  );
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [pendingStudentSig, setPendingStudentSig] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [printModal, setPrintModal] = useState<PrintModal>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentationComplete, setDocumentationComplete] = useState(false);

  const [report, setReport] = useState<CarDraft>(() => ({
    lesson_topic: "Career clusters and local employers",
    learning_objective:
      "Students will identify two careers of interest and one local employer in each cluster.",
    lesson_structure: "Warm-up, small-group research, share-out, exit ticket.",
    participant_count: null,
    students_on_time: true,
    students_engaged: true,
    students_participated: true,
    students_disruptive: false,
    faculty_present: true,
    additional_notes: "",
    signature_data: null,
    signed_date: FIELD_DEMO_SESSION.sessionDate,
    status: "draft",
  }));

  const printRef = useRef<HTMLDivElement>(null);
  const currentTraining =
    FIELD_DEMO_TRAINING_STEPS.find((s) => s.id === trainingStep) ?? FIELD_DEMO_TRAINING_STEPS[0]!;

  const stepFocus = currentTraining.focus;
  const highlight = useCallback(
    (focus: (typeof FIELD_DEMO_TRAINING_STEPS)[number]["focus"]) =>
      stepFocus === focus ? "ring-2 ring-brand-gold ring-offset-2" : "",
    [stepFocus]
  );

  const presentCount = attendance.filter((a) => a.present).length;

  const fieldDemoDataOverride = useMemo(
    () => ({
      authorizations: [
        {
          id: FIELD_DEMO_AUTH.id,
          auth_number: FIELD_DEMO_AUTH.authNumber,
          auth_type: FIELD_DEMO_AUTH.authType,
          service_code: FIELD_DEMO_AUTH.serviceCode,
          service_label: FIELD_DEMO_AUTH.serviceLabel,
          service_month: FIELD_DEMO_AUTH.serviceMonth,
          school_name: FIELD_DEMO_AUTH.schoolName,
          group_name: FIELD_DEMO_AUTH.groupName,
          instructor_name: FIELD_DEMO_AUTH.instructorName,
          class_time: FIELD_DEMO_AUTH.classTime,
          released: true,
        },
      ],
      rosters: {
        [FIELD_DEMO_AUTH.id]: FIELD_DEMO_STUDENTS.map((s) => ({
          id: s.id,
          participantId: s.participantId,
          fullName: s.fullName,
          unitsApproved: 4,
        })),
      },
      pipeline: [],
      worksheetImports: [],
      sessions: [],
    }),
    []
  );

  const syncParticipantCount = useMemo(() => {
    if (report.participant_count === null && presentCount > 0) {
      return presentCount;
    }
    return report.participant_count;
  }, [presentCount, report.participant_count]);

  function openPrint(kind: PrintModal) {
    setPrintModal(kind);
    if (kind === "roster") setTrainingStep(4);
    if (kind === "activity-plan") setTrainingStep(5);
  }

  function handlePrint() {
    const el = printRef.current;
    if (!el) return;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Pre-ETS training print</title></head><body style="font-family:Helvetica,Arial,sans-serif;margin:24px">${el.innerHTML}</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  }

  function simulateUpload(file: File | undefined) {
    if (!file) return;
    setUploadedFileName(file.name);
    setMessage("Signed roster uploaded to Google Drive (training simulation).");
    setTrainingStep(8);
    setError(null);
  }

  function saveStudentSignature(studentId: string, signatureData: string | null) {
    setAttendance((rows) =>
      rows.map((row) =>
        row.id === studentId
          ? {
              ...row,
              roster_signature_data: signatureData,
              present: Boolean(signatureData),
            }
          : row
      )
    );
    setActiveStudentId(null);
    setPendingStudentSig(null);
    setMessage(
      signatureData ? "Student signature saved (training simulation)." : "Signature removed."
    );
    setTrainingStep(5);
    setError(null);
  }

  function finalizeDemoRosterToDrive() {
    const signed = attendance.filter((a) => a.roster_signature_data).length;
    if (signed < 1) {
      setError("Collect at least one student signature first.");
      return;
    }
    setUploadedFileName(`signed-roster-in-app-peach-demo.pdf (${signed} signatures)`);
    setMessage("Roster PDF saved to Google Drive (training simulation).");
    setTrainingStep(9);
    setError(null);
  }

  function saveCar(submit: boolean) {
    setError(null);
    if (submit) {
      if (!report.signature_data?.startsWith("data:image/")) {
        setError("Draw your signature before submitting the Class Activity Report.");
        return;
      }
      if (!report.signed_date) {
        setError("Enter the signed date before submitting.");
        return;
      }
      setReport((r) => ({ ...r, status: "submitted" }));
      setDocumentationComplete(true);
      setMessage("Lesson Activity Report submitted. Session documentation complete (training).");
      setTrainingStep(10);
      return;
    }
    setMessage("CAR draft saved (training — nothing sent).");
  }

  function setCarAnswer(
    key: (typeof FIELD_DEMO_CAR_QUESTIONS)[number]["key"],
    value: boolean
  ) {
    setReport((r) => ({ ...r, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">Training</p>
        <h1 className="mt-1 text-2xl font-bold text-brand-black">
          Pre-ETS field delivery — rosters, signatures &amp; CAR
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-brand-black/70">
          Interactive sample of what <strong>Transition Specialists</strong> and{" "}
          <strong>Transition Instructors</strong> see after Accounts releases a roster. Walk through
          notifications, <strong>Sessions &amp; reports</strong>,{" "}
          <strong>Print roster PDF</strong>, <strong>Print Activity Plan</strong> (paper Class
          Activity Report), signed roster upload, attendance, and in-app CAR with signature. Nothing
          here writes to production.
        </p>
        <p className="mt-2 text-sm text-brand-black/65">
          Sample: {FIELD_DEMO_AUTH.schoolName} · {FIELD_DEMO_AUTH.instructorName} · October 2025
        </p>
        {variant === "dashboard" ? (
          <p className="mt-2 text-sm">
            <Link href="/dashboard/pre-ets" className="font-semibold text-brand-green hover:underline">
              ← Pre-ETS workspace
            </Link>
            {" · "}
            <Link href="/dashboard/pre-ets/demo" className="font-semibold text-brand-green hover:underline">
              Authorization process demo
            </Link>
            {" · "}
            <Link
              href="/walkthrough/pre-ets/field-delivery"
              className="font-semibold text-brand-green hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Shareable walkthrough link
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-sm">
            <Link href="/login" className="font-semibold text-brand-green hover:underline">
              Staff login
            </Link>
            {" · "}
            <Link href="/dashboard/pre-ets/demo" className="font-semibold text-brand-green hover:underline">
              Full process demo (login required)
            </Link>
          </p>
        )}
      </header>

      <ol className="flex flex-wrap gap-2">
        {FIELD_DEMO_TRAINING_STEPS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setTrainingStep(s.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold sm:px-3 sm:text-xs ${
                trainingStep === s.id
                  ? "bg-brand-gold text-white"
                  : "bg-neutral-100 text-brand-black/70 hover:bg-neutral-200"
              }`}
            >
              {s.id}. {s.title}
            </button>
          </li>
        ))}
      </ol>

      <div className={`rounded-xl border border-brand-green/30 bg-brand-green/5 p-4 ${highlight("notification")}`}>
        <p className="text-sm font-semibold text-brand-black">
          Step {currentTraining.id}: {currentTraining.title}
        </p>
        <p className="mt-1 text-sm text-brand-black/75">{currentTraining.summary}</p>
      </div>

      <div
        className={`rounded-xl border border-neutral-200 bg-white p-4 text-sm ${highlight("notification")}`}
      >
        <p className="font-semibold text-brand-black">Notification (example)</p>
        <p className="mt-1 text-brand-black/70">
          <span className="font-medium">Pre-ETS roster released</span> — {FIELD_DEMO_AUTH.schoolName}{" "}
          ({FIELD_DEMO_AUTH.serviceLabel}) is ready for {FIELD_DEMO_AUTH.serviceMonth}. Open{" "}
          <button
            type="button"
            className="font-semibold text-brand-green underline"
            onClick={() => {
              setWorkspaceTab("authorizations");
              setTrainingStep(2);
            }}
          >
            Rosters &amp; auths
          </button>{" "}
          or{" "}
          <button
            type="button"
            className="font-semibold text-brand-green underline"
            onClick={() => {
              setWorkspaceTab("sessions");
              setTrainingStep(3);
            }}
          >
            Sessions &amp; reports
          </button>
          .
        </p>
      </div>

      <PreEtsDemoWorkspaceChrome
        tabs={[
          { id: "authorizations", label: "Rosters & auths" },
          { id: "sessions", label: "Sessions & reports" },
        ]}
        activeTab={workspaceTab}
        onTabChange={(id) => setWorkspaceTab(id as "authorizations" | "sessions")}
      >
        {workspaceTab === "authorizations" ? (
          <div className={highlight("authorizations")}>
            <PreEtsDemoAuthorizationsPanel
              step={4}
              role="field"
              dataOverride={fieldDemoDataOverride}
            />
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className={`space-y-4 ${highlight("sessions")}`}>
              <div>
                <h2 className="text-lg font-semibold text-brand-black">Sessions</h2>
                <p className="mt-1 text-sm text-brand-black/65">
                  Schedule sessions, collect student signatures on the roster in-app (recommended) or
                  print a paper roster, upload signed rosters to Drive, and submit Lesson Activity
                  Reports.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
                <select className="rounded-lg border border-neutral-300 px-2 py-1.5" disabled defaultValue="">
                  <option value="">Authorization…</option>
                  <option value="demo">{FIELD_DEMO_AUTH.authNumber}</option>
                </select>
                <input type="date" className="rounded-lg border border-neutral-300 px-2 py-1.5" disabled />
                <span className="cursor-not-allowed rounded-lg bg-brand-gold/40 px-3 py-1.5 text-sm font-semibold text-white/90">
                  Add session
                </span>
              </div>
              <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
                <li>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-brand-green bg-brand-green/5 px-3 py-2 text-left text-sm"
                  >
                    <p className="font-medium">{FIELD_DEMO_SESSION.schoolName}</p>
                    <p className="text-brand-black/60">
                      {FIELD_DEMO_SESSION.sessionDate} · scheduled
                      {uploadedFileName ? " · roster uploaded" : ""}
                      {report.status === "submitted" ? " · CAR submitted" : ""}
                      {documentationComplete ? " · complete" : ""}
                    </p>
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <div
                className={`rounded-xl border border-neutral-200 bg-white p-4 ${highlight("print-roster")} ${highlight("print-plan")} ${highlight("upload")} ${highlight("attendance")}`}
              >
                <h3 className="font-semibold text-brand-black">
                  {FIELD_DEMO_SESSION.schoolName} · {FIELD_DEMO_SESSION.sessionDate}
                </h3>
                <p className="mt-1 text-xs text-brand-black/60">
                  Auth {FIELD_DEMO_SESSION.authNumber} · scheduled
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-medium text-brand-black/70">Service code: </span>
                  <PreEtsServiceCodeDisplay
                    code={FIELD_DEMO_SESSION.serviceCode}
                    label={FIELD_DEMO_SESSION.serviceLabel}
                    prominent
                  />
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`rounded-lg border border-brand-gold px-3 py-1.5 text-sm font-semibold text-brand-gold ${highlight("print-roster")}`}
                    onClick={() => openPrint("roster")}
                  >
                    Print roster PDF
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg border border-brand-gold px-3 py-1.5 text-sm font-semibold text-brand-gold ${highlight("print-plan")}`}
                    onClick={() => openPrint("activity-plan")}
                  >
                    Print Activity Plan
                  </button>
                  {report.status === "submitted" ? (
                    <button
                      type="button"
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-brand-black/80"
                      onClick={() => openPrint("filled-car")}
                    >
                      Download filled CAR PDF
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-brand-black/60">
                  In the live app this button is labeled <strong>Print Activity Plan</strong> (paper
                  Class Activity Report). Some teams also refer to it as the activity report — it is
                  not the ES caseload &quot;Generate Activity Report&quot; on client profiles.
                </p>
                <p className="mt-2 text-xs text-brand-black/60">
                  Bring a printed Activity Plan to each session. You may also complete checkboxes and
                  sign in the app below — when documentation is complete, the signed roster and CAR
                  are emailed to Accounts and your supervisor.
                </p>

                <div className={`mt-4 space-y-3 text-sm ${highlight("attendance")}`}>
                  <p className="font-medium">Collect student signatures (recommended)</p>
                  <p className="text-xs text-brand-black/60">
                    Tap a student → hand them the device → Save signature. Then save the roster to
                    Drive.
                  </p>
                  <ul className="divide-y rounded-lg border border-neutral-200">
                    {attendance.map((row) => {
                      const signed = Boolean(row.roster_signature_data);
                      return (
                        <li key={row.id} className="flex flex-wrap items-center gap-2 p-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{row.fullName}</p>
                            <p className="text-xs text-brand-black/50">{row.participantId}</p>
                          </div>
                          <span
                            className={`text-xs font-semibold ${signed ? "text-brand-green" : "text-brand-black/45"}`}
                          >
                            {signed ? "Signed" : "Not signed"}
                          </span>
                          <button
                            type="button"
                            className="rounded-lg border border-brand-gold px-3 py-1.5 text-xs font-semibold text-brand-gold"
                            onClick={() => {
                              setActiveStudentId(row.id);
                              setPendingStudentSig(row.roster_signature_data);
                              setTrainingStep(4);
                            }}
                          >
                            {signed ? "View / re-sign" : "Collect signature"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {attendance.some((a) => a.roster_signature_data) ? (
                    <button
                      type="button"
                      className={`rounded-lg bg-brand-gold px-3 py-1.5 text-sm font-semibold text-white ${highlight("upload")}`}
                      onClick={() => finalizeDemoRosterToDrive()}
                    >
                      Save roster to Google Drive
                    </button>
                  ) : null}
                </div>

                <div className={`mt-4 space-y-2 text-sm ${highlight("upload")}`}>
                  <p className="font-medium">Or upload scanned paper roster (PDF)</p>
                  {uploadedFileName ? (
                    <p className="text-brand-black/60">On file: {uploadedFileName}</p>
                  ) : (
                    <p className="text-brand-black/55">No signed roster on file yet.</p>
                  )}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="block w-full text-sm"
                    onChange={(e) => simulateUpload(e.target.files?.[0])}
                  />
                </div>
              </div>

              <div className={`rounded-xl border border-neutral-200 bg-white p-4 ${highlight("car")}`}>
                <h3 className="font-semibold text-brand-black">
                  Lesson Activity Report (Activity Plan)
                </h3>
                <p className="mt-1 text-xs text-brand-black/60">
                  Optional in-app copy — a paper Activity Plan is still required for each session.
                </p>
                <div className="mt-4 space-y-3 text-sm">
                  <label className="block">
                    <span className="font-medium">Session date</span>
                    <input
                      type="date"
                      className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                      value={report.signed_date}
                      onChange={(e) =>
                        setReport((r) => ({ ...r, signed_date: e.target.value || "" }))
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium">Lesson topic</span>
                    <input
                      className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                      value={report.lesson_topic}
                      onChange={(e) => setReport((r) => ({ ...r, lesson_topic: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium">Learning objective</span>
                    <textarea
                      className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                      rows={2}
                      value={report.learning_objective}
                      onChange={(e) =>
                        setReport((r) => ({ ...r, learning_objective: e.target.value }))
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium">Lesson structure</span>
                    <textarea
                      className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                      rows={2}
                      value={report.lesson_structure}
                      onChange={(e) =>
                        setReport((r) => ({ ...r, lesson_structure: e.target.value }))
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium">Number of participants</span>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 block w-full max-w-[12rem] rounded-lg border border-neutral-300 px-3 py-2"
                      value={syncParticipantCount ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        setReport((r) => ({
                          ...r,
                          participant_count: raw === "" ? null : Number.parseInt(raw, 10) || 0,
                        }));
                      }}
                    />
                  </label>
                  {FIELD_DEMO_CAR_QUESTIONS.map((q) => (
                    <fieldset key={q.key} className="space-y-1.5">
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
                      value={report.additional_notes}
                      onChange={(e) =>
                        setReport((r) => ({ ...r, additional_notes: e.target.value }))
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium">Signed date</span>
                    <input
                      type="date"
                      className="mt-1 block w-full max-w-[14rem] rounded-lg border border-neutral-300 px-3 py-2"
                      value={report.signed_date}
                      onChange={(e) =>
                        setReport((r) => ({ ...r, signed_date: e.target.value || "" }))
                      }
                    />
                  </label>
                  <div className={highlight("paper-sign")}>
                    <SignaturePad
                      label="Instructor signature (in-app CAR)"
                      value={report.signature_data}
                      onChange={(dataUrl) =>
                        setReport((r) => ({ ...r, signature_data: dataUrl || null }))
                      }
                    />
                    <p className="mt-1 text-xs text-brand-black/55">
                      Paper roster: students sign in the Student Signature column; you sign the
                      instructor attestation at the bottom of the printed roster (step 6).
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium"
                      onClick={() => saveCar(false)}
                    >
                      Save draft
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white"
                      onClick={() => saveCar(true)}
                    >
                      Submit CAR
                    </button>
                  </div>
                  {report.status === "submitted" ? (
                    <p className="text-xs text-brand-green">Report status: submitted</p>
                  ) : null}
                </div>
              </div>

              {documentationComplete ? (
                <div
                  className={`rounded-xl border border-brand-green/40 bg-brand-green/5 p-4 text-sm ${highlight("complete")}`}
                >
                  <p className="font-semibold text-brand-black">Documentation complete</p>
                  <p className="mt-1 text-brand-black/70">
                    Signed roster on file, CAR submitted, session marked complete — Accounts and your
                    supervisor receive the documentation package (production behavior).
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </PreEtsDemoWorkspaceChrome>

      {message ? <p className="text-sm text-brand-green">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {activeStudentId ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
            <h4 className="text-base font-semibold text-brand-black">
              {attendance.find((a) => a.id === activeStudentId)?.fullName ?? "Student"}
            </h4>
            <div className="mt-4">
              <SignaturePad
                commitMode="manual"
                label="Student signature"
                value={pendingStudentSig}
                height={160}
                onChange={(dataUrl) => {
                  saveStudentSignature(activeStudentId, dataUrl || null);
                }}
              />
            </div>
            <button
              type="button"
              className="mt-4 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium"
              onClick={() => {
                setActiveStudentId(null);
                setPendingStudentSig(null);
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {printModal ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:relative print:inset-auto print:block print:bg-transparent print:p-0"
          role="dialog"
          aria-modal="true"
          aria-label="Print preview"
        >
          <div className="my-8 w-full max-w-4xl rounded-xl bg-white shadow-xl print:my-0 print:max-w-none print:shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3 print:hidden">
              <p className="text-sm font-semibold text-brand-black">
                {printModal === "roster"
                  ? "Sign-in roster (sample PDF layout)"
                  : printModal === "filled-car"
                    ? "Filled Class Activity Report (sample)"
                    : "Activity Plan / blank CAR (sample)"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-brand-gold px-3 py-1.5 text-sm font-semibold text-white"
                  onClick={() => handlePrint()}
                >
                  Print
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium"
                  onClick={() => setPrintModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
            <div ref={printRef} className="p-4 print:p-0">
              {printModal === "roster" ? (
                <PreEtsDemoRosterPrintSheet sessionDate={FIELD_DEMO_SESSION.sessionDate} />
              ) : (
                <PreEtsDemoActivityPlanPrintSheet
                  sessionDate={FIELD_DEMO_SESSION.sessionDate}
                  filledCar={printModal === "filled-car"}
                  lessonTopic={report.lesson_topic}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
