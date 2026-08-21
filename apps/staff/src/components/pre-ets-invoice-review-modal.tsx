"use client";

import { useEffect, useState } from "react";
import { SignaturePad } from "@/components/signature-pad";
import type {
  InvoicePacketEditableOverrides,
  InvoicePacketPdfData,
  InvoicePacketSessionRow,
} from "@wayfinder/supabase/pre-ets-invoice-packet";

type Props = {
  packetId: string;
  mode: "download" | "archive";
  onClose: () => void;
  onComplete: (message: string) => void;
};

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function PreEtsInvoiceReviewModal({ packetId, mode, onClose, onComplete }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InvoicePacketPdfData | null>(null);
  const [instructorNames, setInstructorNames] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [serviceLabel, setServiceLabel] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [authType, setAuthType] = useState<"group" | "individual">("group");
  const [totalUnits, setTotalUnits] = useState(0);
  const [totalAmountCents, setTotalAmountCents] = useState(0);
  const [sessions, setSessions] = useState<InvoicePacketSessionRow[]>([]);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signedDate, setSignedDate] = useState(todayYmd());

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/pre-ets/invoice-packets/${packetId}/preview`);
        const json = (await res.json()) as { packet?: InvoicePacketPdfData; error?: string };
        if (!res.ok || !json.packet) {
          setError(json.error ?? "Could not load invoice preview.");
          return;
        }
        const packet = json.packet;
        setData(packet);
        setInstructorNames(packet.instructorNames);
        setSchoolName(packet.schoolName);
        setServiceCode(packet.serviceCode);
        setServiceLabel(packet.serviceLabel ?? "");
        setInvoiceNumber(packet.invoiceNumber ?? "");
        setAuthType(packet.authType);
        setTotalUnits(packet.totalUnits);
        setTotalAmountCents(packet.totalAmountCents);
        setSessions(packet.sessions.map((s) => ({ ...s, presentNames: [...s.presentNames] })));
      } catch {
        setError("Could not load invoice preview.");
      } finally {
        setLoading(false);
      }
    })();
  }, [packetId]);

  function updateSession(index: number, patch: Partial<InvoicePacketSessionRow>) {
    setSessions((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const next = { ...s, ...patch };
        if (patch.units !== undefined && data) {
          next.amountCents = Math.round(patch.units * data.rateCents);
          next.amountLabel = (next.amountCents / 100).toFixed(2);
        }
        if (patch.amountCents !== undefined) {
          next.amountLabel = (patch.amountCents / 100).toFixed(2);
        }
        return next;
      })
    );
  }

  function buildOverrides(): InvoicePacketEditableOverrides {
    return {
      instructorNames,
      schoolName,
      serviceCode,
      serviceLabel: serviceLabel || null,
      invoiceNumber: invoiceNumber.trim() || null,
      authType,
      totalUnits,
      totalAmountCents,
      accountsSignatureData: signatureData,
      accountsSignedDate: signedDate,
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        groupName: s.groupName,
        serviceCode: s.serviceCode,
        serviceDescription: s.serviceDescription,
        sessionDateLabel: s.sessionDateLabel,
        startTimeLabel: s.startTimeLabel,
        endTimeLabel: s.endTimeLabel,
        units: s.units,
        amountCents: s.amountCents,
        presentNames: s.presentNames,
      })),
    };
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!signatureData?.startsWith("data:image/")) {
        setError("Draw the Accounts Specialist signature before continuing.");
        return;
      }
      if (!signedDate) {
        setError("Enter the signed date before continuing.");
        return;
      }

      const overrides = buildOverrides();

      if (mode === "download") {
        const res = await fetch(`/api/pre-ets/invoice-packets/${packetId}/pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrides }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(json?.error ?? "Could not generate PDF.");
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
          `pre-ets-invoice-${packetId.slice(0, 8)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        onComplete("Invoice packet downloaded.");
        onClose();
        return;
      }

      const res = await fetch(`/api/pre-ets/invoice-packets/${packetId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides, markReady: true }),
      });
      const json = (await res.json()) as { error?: string; driveUrl?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not archive invoice packet.");
        return;
      }
      onComplete(
        json.driveUrl
          ? "Packet marked ready and archived to Google Drive."
          : "Packet marked ready and archived."
      );
      onClose();
    } catch {
      setError("Something went wrong while generating the packet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-4xl rounded-xl border border-neutral-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-brand-black">Review invoice packet</h3>
            <p className="mt-1 text-sm text-brand-black/65">
              Edit any fields below, sign as Accounts Specialist, then{" "}
              {mode === "download" ? "download" : "mark ready and archive"} the packet (Invoice →
              each session CAR → signed roster).
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {loading ? <p className="text-sm text-brand-black/60">Loading…</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          {data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium">Auth type</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                    value={authType}
                    onChange={(e) => setAuthType(e.target.value as "group" | "individual")}
                  >
                    <option value="group">Group</option>
                    <option value="individual">Individual</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Invoice #</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">School name</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Instructor(s)</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                    value={instructorNames}
                    onChange={(e) => setInstructorNames(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Service code</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                    value={serviceCode}
                    onChange={(e) => setServiceCode(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Service description</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                    value={serviceLabel}
                    onChange={(e) => setServiceLabel(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Total units</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                    value={totalUnits}
                    onChange={(e) => setTotalUnits(Number(e.target.value) || 0)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Total amount ($)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                    value={(totalAmountCents / 100).toFixed(2)}
                    onChange={(e) =>
                      setTotalAmountCents(Math.round((Number(e.target.value) || 0) * 100))
                    }
                  />
                </label>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-brand-black">Sessions</h4>
                {sessions.length === 0 ? (
                  <p className="text-sm text-brand-black/55">No completed sessions on this auth.</p>
                ) : (
                  sessions.map((session, index) => (
                    <div
                      key={session.sessionId}
                      className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-3"
                    >
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-black/55">
                        Session {index + 1}
                        {session.hasActivityReport ? "" : " · CAR missing (will skip)"}
                        {session.signedRosterDriveFileId
                          ? ""
                          : " · Signed roster missing (will skip)"}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="block text-xs">
                          Group name
                          <input
                            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                            value={session.groupName}
                            onChange={(e) => updateSession(index, { groupName: e.target.value })}
                          />
                        </label>
                        <label className="block text-xs">
                          Date of service
                          <input
                            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                            value={session.sessionDateLabel}
                            onChange={(e) =>
                              updateSession(index, { sessionDateLabel: e.target.value })
                            }
                          />
                        </label>
                        <label className="block text-xs">
                          Service code
                          <input
                            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                            value={session.serviceCode}
                            onChange={(e) => updateSession(index, { serviceCode: e.target.value })}
                          />
                        </label>
                        <label className="block text-xs">
                          Service description
                          <input
                            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                            value={session.serviceDescription}
                            onChange={(e) =>
                              updateSession(index, { serviceDescription: e.target.value })
                            }
                          />
                        </label>
                        <label className="block text-xs">
                          Start time
                          <input
                            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                            value={session.startTimeLabel}
                            onChange={(e) =>
                              updateSession(index, { startTimeLabel: e.target.value })
                            }
                          />
                        </label>
                        <label className="block text-xs">
                          End time
                          <input
                            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                            value={session.endTimeLabel}
                            onChange={(e) => updateSession(index, { endTimeLabel: e.target.value })}
                          />
                        </label>
                        <label className="block text-xs">
                          Units
                          <input
                            type="number"
                            min={0}
                            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                            value={session.units}
                            onChange={(e) =>
                              updateSession(index, { units: Number(e.target.value) || 0 })
                            }
                          />
                        </label>
                        <label className="block text-xs">
                          Amount ($)
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                            value={(session.amountCents / 100).toFixed(2)}
                            onChange={(e) =>
                              updateSession(index, {
                                amountCents: Math.round((Number(e.target.value) || 0) * 100),
                              })
                            }
                          />
                        </label>
                        <label className="block text-xs sm:col-span-2">
                          Present students (one name per line, alphabetical preferred)
                          <textarea
                            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                            rows={3}
                            value={session.presentNames.join("\n")}
                            onChange={(e) =>
                              updateSession(index, {
                                presentNames: e.target.value
                                  .split("\n")
                                  .map((n) => n.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <label className="block text-sm">
                <span className="font-medium">Accounts signed date</span>
                <input
                  type="date"
                  className="mt-1 block w-full max-w-[14rem] rounded-lg border border-neutral-300 px-3 py-2"
                  value={signedDate}
                  onChange={(e) => setSignedDate(e.target.value)}
                />
              </label>

              <SignaturePad
                label="Accounts Specialist / Provider signature"
                value={signatureData}
                onChange={(dataUrl) => setSignatureData(dataUrl || null)}
              />
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-200 px-5 py-4">
          <button
            type="button"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => void submit()}
            disabled={busy || loading || !data}
          >
            {busy
              ? mode === "download"
                ? "Generating…"
                : "Archiving…"
              : mode === "download"
                ? "Sign & download packet"
                : "Sign, mark ready & archive"}
          </button>
        </div>
      </div>
    </div>
  );
}
