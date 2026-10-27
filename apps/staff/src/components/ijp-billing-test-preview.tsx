"use client";

import { SignaturePad } from "@/components/signature-pad";
import { IJP_ATTESTATION_TEXT } from "@/lib/ijp-attestation-text";
import type { IjpInvoiceLineItem } from "@wayfinder/supabase/ijp-billing-lines";
import { formatIjpInvoiceAmount } from "@wayfinder/supabase/ijp-billing-settings";
import { USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useState } from "react";

type Props = {
  clientId: string;
  serviceMonth: string;
  disabled?: boolean;
};

type BillablePreview = {
  lineItems: IjpInvoiceLineItem[];
  totalHours: number;
  totalAmountCents: number;
  approvedEntryCount: number;
  billableEntryCount: number;
};

export function IjpBillingTestPreview({ clientId, serviceMonth, disabled = false }: Props) {
  const [preview, setPreview] = useState<BillablePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const reloadLines = useCallback(async () => {
    if (!clientId.trim()) {
      setPreview(null);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(
      `/api/ijp-billing/test/billable-lines?clientId=${encodeURIComponent(clientId.trim())}&serviceMonth=${encodeURIComponent(serviceMonth)}`
    );
    const data = (await res.json()) as BillablePreview & { error?: string; lineItems?: IjpInvoiceLineItem[] };
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      setPreview(null);
      return;
    }
    setPreview({
      lineItems: data.lineItems ?? [],
      totalHours: data.totalHours ?? 0,
      totalAmountCents: data.totalAmountCents ?? 0,
      approvedEntryCount: data.approvedEntryCount ?? 0,
      billableEntryCount: data.billableEntryCount ?? 0,
    });
  }, [clientId, serviceMonth]);

  useEffect(() => {
    void reloadLines();
  }, [reloadLines]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function updateAttestationPreview(includeSignature: boolean) {
    if (!clientId.trim()) return;
    setPdfBusy(true);
    setError(null);
    const res = await fetch("/api/ijp-billing/test/attestation-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientId.trim(),
        serviceMonth,
        signatureDataUrl: includeSignature && signature.startsWith("data:image/") ? signature : null,
        facilitatorName: "Preview (billing test)",
      }),
    });
    setPdfBusy(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    const blob = await res.blob();
    const nextUrl = URL.createObjectURL(blob);
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
  }

  const blankPreviewHref =
    clientId.trim() &&
    `/api/ijp-billing/test/attestation-preview?clientId=${encodeURIComponent(clientId.trim())}&serviceMonth=${encodeURIComponent(serviceMonth)}`;

  return (
    <div className="mt-6 space-y-6 border-t border-amber-300/60 pt-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-amber-950">Billable time → invoice lines</h3>
          <button
            type="button"
            disabled={disabled || loading || !clientId.trim()}
            className="rounded-lg border border-amber-800 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 disabled:opacity-50"
            onClick={() => void reloadLines()}
          >
            {loading ? "Refreshing…" : "Refresh from billable time"}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}
        {preview ? (
          <>
            <p className="mt-2 text-xs text-amber-900/80">
              {preview.approvedEntryCount} ES time{" "}
              {preview.approvedEntryCount === 1 ? "entry" : "entries"} in{" "}
              {serviceMonth.slice(0, 7)} (non-rejected) · {preview.billableEntryCount} client
              billable · {preview.lineItems.length} invoice{" "}
              {preview.lineItems.length === 1 ? "line" : "lines"} ·{" "}
              {preview.totalHours.toFixed(2)} h · {formatIjpInvoiceAmount(preview.totalAmountCents)}
            </p>
            {preview.approvedEntryCount === 0 ? (
              <p className="mt-2 text-sm text-amber-900">
                No time entries for this client in the selected service month (default is the prior
                calendar month). Change the month to match the client&apos;s timesheet, or log time
                on the caseload, then refresh.
              </p>
            ) : preview.billableEntryCount === 0 ? (
              <p className="mt-2 text-sm text-amber-900">
                Entries exist but none count as client billable for this month (activity type or
                note-only contact). Check the weekly timesheet billable column for the same dates.
              </p>
            ) : null}
            {preview.lineItems.length > 0 ? (
              <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-amber-200 bg-white">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-amber-50 text-amber-950">
                    <tr>
                      <th className="px-2 py-1.5 font-semibold">Date</th>
                      <th className="px-2 py-1.5 font-semibold">Time</th>
                      <th className="px-2 py-1.5 font-semibold">ES</th>
                      <th className="px-2 py-1.5 font-semibold">Description</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Hrs</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lineItems.map((line) => (
                      <tr key={line.entryId} className="border-t border-amber-100">
                        <td className="whitespace-nowrap px-2 py-1.5">{line.serviceDate}</td>
                        <td className="whitespace-nowrap px-2 py-1.5">
                          {line.startTime && line.endTime
                            ? `${line.startTime}–${line.endTime}`
                            : "—"}
                        </td>
                        <td className="px-2 py-1.5">{line.instructorName}</td>
                        <td className="max-w-xs truncate px-2 py-1.5" title={line.description}>
                          {line.description}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right">
                          {line.hours.toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right">
                          {formatIjpInvoiceAmount(line.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : loading ? (
          <p className="mt-2 text-sm text-amber-900/70">Loading billable lines…</p>
        ) : null}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-amber-950">Client signing preview (attestation)</h3>
        <p className="mt-1 text-xs text-amber-900/80">
          Same attestation text and signature pad clients see in the profile. Preview PDF uses the{" "}
          <code className="rounded bg-white px-1">ParticipantSignature</code> placeholder — does not
          upload to Drive or change production flags.
        </p>
        <div className="mt-4 rounded-lg border border-amber-200 bg-white p-4">
          <p className="text-sm leading-relaxed text-brand-black/85">{IJP_ATTESTATION_TEXT}</p>
          <div className="mt-4">
            <SignaturePad
              value={signature}
              onChange={setSignature}
              disabled={disabled || pdfBusy}
              label="Client signature (preview)"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {blankPreviewHref ? (
              <a
                href={blankPreviewHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-brand-black"
              >
                Open blank PDF in new tab
              </a>
            ) : null}
            <button
              type="button"
              disabled={disabled || pdfBusy || !clientId.trim()}
              className="rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void updateAttestationPreview(false)}
            >
              Preview PDF (no signature)
            </button>
            <button
              type="button"
              disabled={
                disabled || pdfBusy || !clientId.trim() || !signature.startsWith("data:image/")
              }
              className="rounded-lg border border-amber-800 px-3 py-2 text-sm font-semibold text-amber-950 disabled:opacity-50"
              onClick={() => void updateAttestationPreview(true)}
            >
              Preview PDF with signature
            </button>
          </div>
          {pdfUrl ? (
            <iframe
              title="IJP attestation preview"
              src={pdfUrl}
              className="mt-4 h-[min(520px,70vh)] w-full rounded-lg border border-neutral-200 bg-neutral-100"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
