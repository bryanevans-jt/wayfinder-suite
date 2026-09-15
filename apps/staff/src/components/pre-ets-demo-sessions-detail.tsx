"use client";

import { PreEtsServiceCodeDisplay } from "@/components/pre-ets-service-code-display";
import { SignaturePad } from "@/components/signature-pad";
import type { DemoRosterStudent, DemoSession } from "@/lib/pre-ets-demo-mock-data";
import { FIELD_DEMO_CAR_QUESTIONS } from "@/lib/pre-ets-field-delivery-demo-data";
import Link from "next/link";

const DEMO_CAR_DRAFT = {
  lesson_topic: "Career clusters and local employers",
  learning_objective:
    "Students will identify two careers of interest and one local employer in each cluster.",
  lesson_structure: "Warm-up, small-group research, share-out, exit ticket.",
  participant_count: 4,
  students_on_time: true,
  students_engaged: true,
  students_participated: true,
  students_disruptive: false,
  faculty_present: true,
  additional_notes: "",
  signed_date: "2025-10-15",
};

type Props = {
  session: DemoSession;
  rosterStudents: DemoRosterStudent[];
  /** Process demo: read-only preview. Field delivery uses its own interactive panel. */
  mode: "preview";
};

/**
 * Session detail column aligned with {@link PreEtsSessionsPanel} and the field-delivery demo.
 */
export function PreEtsDemoSessionsDetail({ session, rosterStudents, mode }: Props) {
  const readOnly = mode === "preview";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="font-semibold text-brand-black">
          {session.school_name} · {session.session_date}
        </h3>
        <p className="mt-1 text-xs text-brand-black/60">
          Auth {session.auth_number} · {session.status}
        </p>
        <p className="mt-2 text-sm">
          <span className="font-medium text-brand-black/70">Service code: </span>
          <PreEtsServiceCodeDisplay
            code={session.service_code}
            label={session.service_label}
            prominent
          />
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`rounded-lg border border-brand-gold px-3 py-1.5 text-sm font-semibold text-brand-gold ${
              readOnly ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            Print roster PDF
          </span>
          <span
            className={`rounded-lg border border-brand-gold px-3 py-1.5 text-sm font-semibold text-brand-gold ${
              readOnly ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            Print Activity Plan
          </span>
          {session.has_car ? (
            <span className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-brand-black/80">
              Download filled CAR PDF
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-brand-black/60">
          Collect student signatures in-app below (preferred) or print the roster for paper
          signatures and upload a scan. Bring a printed Activity Plan to class if needed; you may
          also complete the CAR in the app — when documentation is complete, Accounts and your
          supervisor are notified.
        </p>

        <div className="mt-4 space-y-3 text-sm">
          <p className="font-medium">Collect student signatures (recommended)</p>
          <p className="text-xs text-brand-black/60">
            Tap a student → hand them the device → Save signature. Then save the roster to Drive.
          </p>
          <ul className="divide-y rounded-lg border border-neutral-200">
            {rosterStudents.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 p-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.fullName}</p>
                  <p className="text-xs text-brand-black/50">{row.participantId}</p>
                </div>
                <span className="text-xs font-semibold text-brand-black/45">Not signed</span>
                <span className="cursor-not-allowed rounded-lg border border-brand-gold/50 px-3 py-1.5 text-xs font-semibold text-brand-gold/60">
                  Collect signature
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <p className="font-medium">Or upload scanned paper roster (PDF)</p>
          {session.has_signed_roster ? (
            <p className="text-brand-black/60">On file: signed-roster.pdf</p>
          ) : (
            <p className="text-brand-black/55">No signed roster on file yet.</p>
          )}
          <input
            type="file"
            accept="application/pdf"
            disabled
            className="block w-full cursor-not-allowed text-sm opacity-60"
          />
        </div>

        {readOnly ? (
          <p className="mt-4 text-xs text-brand-black/60">
            For hands-on training (signatures, upload, CAR), open the{" "}
            <Link
              href="/dashboard/pre-ets/demo/field-delivery"
              className="font-semibold text-brand-green hover:underline"
            >
              TS/TI roster &amp; CAR walkthrough
            </Link>
            .
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="font-semibold text-brand-black">Lesson Activity Report (Activity Plan)</h3>
        <p className="mt-1 text-xs text-brand-black/60">
          Optional in-app copy — a paper Activity Plan is still required for each session.
        </p>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            <span className="font-medium">Session date</span>
            <input
              type="date"
              disabled={readOnly}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 disabled:bg-neutral-50"
              value={session.session_date}
              readOnly
            />
          </label>
          <label className="block">
            <span className="font-medium">Lesson topic</span>
            <input
              disabled={readOnly}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 disabled:bg-neutral-50"
              value={DEMO_CAR_DRAFT.lesson_topic}
              readOnly
            />
          </label>
          <label className="block">
            <span className="font-medium">Learning objective</span>
            <textarea
              disabled={readOnly}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 disabled:bg-neutral-50"
              rows={2}
              value={DEMO_CAR_DRAFT.learning_objective}
              readOnly
            />
          </label>
          <label className="block">
            <span className="font-medium">Lesson structure</span>
            <textarea
              disabled={readOnly}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 disabled:bg-neutral-50"
              rows={2}
              value={DEMO_CAR_DRAFT.lesson_structure}
              readOnly
            />
          </label>
          <label className="block">
            <span className="font-medium">Number of participants</span>
            <input
              type="number"
              min={0}
              disabled={readOnly}
              className="mt-1 block w-full max-w-[12rem] rounded-lg border border-neutral-300 px-3 py-2 disabled:bg-neutral-50"
              value={DEMO_CAR_DRAFT.participant_count}
              readOnly
            />
          </label>
          {FIELD_DEMO_CAR_QUESTIONS.map((q) => (
            <fieldset key={q.key} className="space-y-1.5" disabled={readOnly}>
              <legend className="text-sm text-brand-black">{q.label}</legend>
              <div className="flex flex-wrap gap-4 pl-0.5">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-neutral-400"
                    checked={DEMO_CAR_DRAFT[q.key] === true}
                    readOnly
                    disabled={readOnly}
                  />
                  Yes
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-neutral-400"
                    checked={DEMO_CAR_DRAFT[q.key] === false}
                    readOnly
                    disabled={readOnly}
                  />
                  No
                </label>
              </div>
            </fieldset>
          ))}
          <label className="block">
            <span className="font-medium">Additional Note(s)</span>
            <textarea
              disabled={readOnly}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 disabled:bg-neutral-50"
              rows={2}
              value={DEMO_CAR_DRAFT.additional_notes}
              readOnly
              placeholder="Optional — left blank on the PDF when empty"
            />
          </label>
          <label className="block">
            <span className="font-medium">Signed date</span>
            <input
              type="date"
              disabled={readOnly}
              className="mt-1 block w-full max-w-[14rem] rounded-lg border border-neutral-300 px-3 py-2 disabled:bg-neutral-50"
              value={DEMO_CAR_DRAFT.signed_date}
              readOnly
            />
          </label>
          <SignaturePad label="Instructor signature" disabled value={null} onChange={() => {}} />
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="cursor-not-allowed rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium opacity-60">
              Save draft
            </span>
            <span className="cursor-not-allowed rounded-lg bg-brand-green/50 px-3 py-1.5 text-sm font-semibold text-white/90">
              Submit CAR
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const PRE_ETS_DEMO_SESSIONS_BLURB =
  "Schedule sessions, collect student signatures on the roster in-app (recommended) or print a paper roster, upload signed rosters to Drive, and submit Lesson Activity Reports.";
