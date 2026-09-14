"use client";

import {
  FIELD_DEMO_AUTH,
  FIELD_DEMO_SESSION,
  FIELD_DEMO_STUDENTS,
  type FieldDemoStudent,
} from "@/lib/pre-ets-field-delivery-demo-data";
import { forwardRef } from "react";

const ROSTER_ATTESTATION =
  "I hereby attest that this information is true, accurate, and complete and understand that any falsification, omission, or concealment of material fact may subject me or the represented organization to administrative, civil, or criminal liability. Furthermore, I am a duly authorized representative to sign such agreement for the party I represent.";

type SheetProps = {
  students?: FieldDemoStudent[];
  sessionDate?: string;
  instructorName?: string;
  lessonTopic?: string;
  filledCar?: boolean;
};

/** Printable HTML mock of the Pre-ETS sign-in roster / time sheet PDF. */
export const PreEtsDemoRosterPrintSheet = forwardRef<HTMLDivElement, SheetProps>(
  function PreEtsDemoRosterPrintSheet(
    { students = FIELD_DEMO_STUDENTS, sessionDate = FIELD_DEMO_SESSION.sessionDate, instructorName = FIELD_DEMO_AUTH.instructorName },
    ref
  ) {
    return (
      <div
        ref={ref}
        className="mx-auto max-w-[8.5in] bg-white p-8 text-black print:p-0 print:shadow-none"
      >
        <h1 className="text-lg font-bold">Joshua Tree Service Group</h1>
        <h2 className="text-base font-bold">Pre-ETS Time Sheet</h2>
        <dl className="mt-4 space-y-1 text-sm">
          <div>
            <dt className="inline font-semibold">Group Authorization #: </dt>
            <dd className="inline">{FIELD_DEMO_AUTH.authNumber}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Date: </dt>
            <dd className="inline">{sessionDate}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">School: </dt>
            <dd className="inline">{FIELD_DEMO_AUTH.schoolName}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Instructor: </dt>
            <dd className="inline">{instructorName}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Topic: </dt>
            <dd className="inline">Job exploration — career interests</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Service Code: </dt>
            <dd className="inline">{FIELD_DEMO_AUTH.serviceCode}</dd>
          </div>
        </dl>
        <table className="mt-6 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-black">
              <th className="py-2 text-left font-bold">Participant ID</th>
              <th className="py-2 text-left font-bold">Student Name</th>
              <th className="py-2 text-left font-bold">Student Signature</th>
              <th className="py-2 text-left font-bold">Date</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-neutral-300">
                <td className="py-3 pr-2 align-bottom">{s.participantId}</td>
                <td className="py-3 pr-2 align-bottom">{s.fullName}</td>
                <td className="py-3 pr-2">
                  <div className="mt-4 border-b border-neutral-500" />
                </td>
                <td className="py-3">
                  <div className="mt-4 border-b border-neutral-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-8 text-[10px] leading-snug text-neutral-800">{ROSTER_ATTESTATION}</p>
        <div className="mt-6 flex flex-wrap gap-8 text-sm">
          <p>
            <span className="font-semibold">Instructor Signature:</span>
            <span className="ml-2 inline-block w-48 border-b border-black" />
          </p>
          <p>
            <span className="font-semibold">Date:</span>
            <span className="ml-2 inline-block w-28 border-b border-black" />
          </p>
        </div>
        <p className="mt-6 text-[10px] text-neutral-500 print:hidden">
          Training sample — same layout as Print roster PDF in Wayfinder Pro.
        </p>
      </div>
    );
  }
);

/** Printable HTML mock of the blank / filled Class Activity Report (Activity Plan). */
export const PreEtsDemoActivityPlanPrintSheet = forwardRef<HTMLDivElement, SheetProps>(
  function PreEtsDemoActivityPlanPrintSheet(
    {
      sessionDate = FIELD_DEMO_SESSION.sessionDate,
      instructorName = FIELD_DEMO_AUTH.instructorName,
      lessonTopic = "Career clusters and local employers",
      filledCar = false,
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        className="mx-auto max-w-[8.5in] bg-white p-8 text-black print:p-0"
      >
        <h1 className="text-lg font-bold">Joshua Tree Service Group</h1>
        <h2 className="text-base font-bold">Pre-ETS Class Activity Report (Activity Plan)</h2>
        <dl className="mt-4 space-y-1 text-sm">
          <div>
            <dt className="inline font-semibold">Authorization #: </dt>
            <dd className="inline">{FIELD_DEMO_AUTH.authNumber}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Session date: </dt>
            <dd className="inline">{sessionDate}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">School: </dt>
            <dd className="inline">{FIELD_DEMO_AUTH.schoolName}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Instructor: </dt>
            <dd className="inline">{instructorName}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Service: </dt>
            <dd className="inline">
              {FIELD_DEMO_AUTH.serviceLabel} ({FIELD_DEMO_AUTH.serviceCode})
            </dd>
          </div>
        </dl>
        <section className="mt-6 space-y-4 text-sm">
          <div>
            <p className="font-semibold">Lesson topic</p>
            <p className="mt-1 min-h-[1.5rem] border-b border-neutral-400">
              {filledCar ? lessonTopic : ""}
            </p>
          </div>
          <div>
            <p className="font-semibold">Learning objective</p>
            <p className="mt-1 min-h-[2.5rem] border border-neutral-300 p-2">
              {filledCar
                ? "Students will identify two careers of interest and one local employer in each cluster."
                : ""}
            </p>
          </div>
          <div>
            <p className="font-semibold">Lesson structure</p>
            <p className="mt-1 min-h-[2.5rem] border border-neutral-300 p-2">
              {filledCar ? "Warm-up, small-group research, share-out, exit ticket." : ""}
            </p>
          </div>
          <p className="font-semibold">Session checklist</p>
          <ul className="mt-2 space-y-2 text-xs">
            {[
              "Students arrived on time",
              "Students engaged in Pre-ETS activities",
              "All present students participated",
              "Disruptive behaviors affected instruction",
              "School faculty / designated staff present",
            ].map((label) => (
              <li key={label} className="flex gap-6">
                <span className="flex-1">{label}</span>
                <span>Yes ☐</span>
                <span>No ☐</span>
              </li>
            ))}
          </ul>
          <div>
            <p className="font-semibold">Additional notes</p>
            <div className="mt-1 min-h-[2rem] border border-neutral-300" />
          </div>
          <div className="flex flex-wrap gap-8 pt-4">
            <p>
              <span className="font-semibold">Instructor signature</span>
              <span className="ml-2 inline-block w-48 border-b border-black align-bottom" />
            </p>
            <p>
              <span className="font-semibold">Signed date</span>
              <span className="ml-2 inline-block w-28 border-b border-black align-bottom" />
            </p>
          </div>
        </section>
        <p className="mt-6 text-[10px] text-neutral-500 print:hidden">
          Training sample — same document as Print Activity Plan / filled CAR PDF in production.
        </p>
      </div>
    );
  }
);
