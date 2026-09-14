"use client";

import { SignaturePad } from "@/components/signature-pad";
import { useState } from "react";

export type RosterAttendanceRow = {
  id: string;
  present: boolean;
  signed_on_roster: boolean;
  roster_signature_data?: string | null;
  roster_signed_date?: string | null;
  pre_ets_students: { participant_id: string | null; full_name: string } | null;
};

type Props = {
  sessionId: string;
  sessionDate: string;
  rows: RosterAttendanceRow[];
  disabled?: boolean;
  onUpdated: () => void;
  onMessage: (msg: string | null) => void;
  onError: (msg: string | null) => void;
};

export function PreEtsStudentRosterSignatures({
  sessionId,
  sessionDate,
  rows,
  disabled = false,
  onUpdated,
  onMessage,
  onError,
}: Props) {
  const [activeRow, setActiveRow] = useState<RosterAttendanceRow | null>(null);
  const [pendingSig, setPendingSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const signedCount = rows.filter((r) => r.roster_signature_data?.startsWith("data:image/")).length;

  async function persistSignature(row: RosterAttendanceRow, signatureData: string | null) {
    setBusy(true);
    onError(null);
    try {
      const res = await fetch(
        `/api/pre-ets/sessions/${sessionId}/attendance/${row.id}/roster-signature`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signatureData,
            signedDate: sessionDate || undefined,
          }),
        }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save signature.");
      onMessage(signatureData ? `${studentName(row)} signature saved.` : "Signature cleared.");
      setActiveRow(null);
      setPendingSig(null);
      onUpdated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save signature.");
    } finally {
      setBusy(false);
    }
  }

  async function finalizeToDrive() {
    setFinalizing(true);
    onError(null);
    try {
      const res = await fetch(`/api/pre-ets/sessions/${sessionId}/roster-signatures/finalize`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string; driveUrl?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save roster to Drive.");
      onMessage("Roster PDF with student signatures saved to Google Drive.");
      onUpdated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save roster to Drive.");
    } finally {
      setFinalizing(false);
    }
  }

  function studentName(row: RosterAttendanceRow) {
    return row.pre_ets_students?.full_name ?? "Student";
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-medium text-brand-black">Collect student signatures (recommended)</p>
        <p className="mt-1 text-xs text-brand-black/60">
          Tap a student, hand your phone or tablet to them to sign, then tap{" "}
          <strong>Save signature</strong>. Use <strong>Clear</strong> to redo before saving. When
          finished, save the roster to Google Drive — or scan a paper roster below instead.
        </p>
      </div>

      <ul className="divide-y rounded-lg border border-neutral-200">
        {rows.length === 0 ? (
          <li className="p-3 text-brand-black/55">No students on this authorization roster.</li>
        ) : (
          rows.map((row) => {
            const signed = Boolean(row.roster_signature_data?.startsWith("data:image/"));
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-2 p-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{studentName(row)}</p>
                  {row.pre_ets_students?.participant_id ? (
                    <p className="text-xs text-brand-black/50">
                      {row.pre_ets_students.participant_id}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`text-xs font-semibold ${signed ? "text-brand-green" : "text-brand-black/45"}`}
                >
                  {signed ? "Signed" : "Not signed"}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded-lg border border-brand-gold px-3 py-1.5 text-xs font-semibold text-brand-gold disabled:opacity-50"
                  onClick={() => {
                    setActiveRow(row);
                    setPendingSig(row.roster_signature_data ?? null);
                    onError(null);
                  }}
                >
                  {signed ? "View / re-sign" : "Collect signature"}
                </button>
              </li>
            );
          })
        )}
      </ul>

      {signedCount > 0 && !disabled ? (
        <button
          type="button"
          disabled={finalizing}
          className="rounded-lg bg-brand-gold px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => void finalizeToDrive()}
        >
          {finalizing ? "Saving…" : `Save roster to Google Drive (${signedCount} signature${signedCount === 1 ? "" : "s"})`}
        </button>
      ) : null}

      {activeRow ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="roster-signature-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
            <h4 id="roster-signature-title" className="text-base font-semibold text-brand-black">
              {studentName(activeRow)}
            </h4>
            <p className="mt-1 text-xs text-brand-black/60">
              Hand the device to the student. When they finish, tap <strong>Save signature</strong>.
            </p>
            <div className="mt-4">
              <SignaturePad
                commitMode="manual"
                label="Student signature"
                value={pendingSig}
                disabled={busy}
                height={160}
                width={480}
                onChange={(dataUrl) => {
                  setPendingSig(dataUrl || null);
                  void persistSignature(activeRow, dataUrl || null);
                }}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium"
                disabled={busy}
                onClick={() => {
                  setActiveRow(null);
                  setPendingSig(null);
                }}
              >
                Close
              </button>
              {activeRow.roster_signature_data ? (
                <button
                  type="button"
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-800"
                  disabled={busy}
                  onClick={() => void persistSignature(activeRow, null)}
                >
                  Remove saved signature
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
