"use client";

import { SignaturePad } from "@/components/signature-pad";
import { USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useState } from "react";

import { IJP_ATTESTATION_TEXT } from "@/lib/ijp-attestation-text";

type Status = {
  serviceMonth: string;
  serviceMonthLabel: string;
  signatureNeeded: boolean;
  hasAttestation: boolean;
  showListFlag: boolean;
  captureOpen: boolean;
  availableMonths?: Array<{ serviceMonth: string; serviceMonthLabel: string }>;
};

type Props = {
  clientId: string;
};

export function IjpClientSignatureSection({ clientId }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [canPickMonth, setCanPickMonth] = useState(false);
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (month?: string | null) => {
    setLoading(true);
    const qs =
      month && month.trim()
        ? `?month=${encodeURIComponent(month.trim())}`
        : "";
    const res = await fetch(`/api/clients/${clientId}/ijp-attestation${qs}`);
    const data = (await res.json()) as {
      status?: Status | null;
      canPickMonth?: boolean;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      setStatus(null);
      setCanPickMonth(false);
    } else {
      setStatus(data.status ?? null);
      setCanPickMonth(Boolean(data.canPickMonth));
      setPickedMonth((prev) => month ?? prev ?? data.status?.serviceMonth ?? null);
      setError(null);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeMonth = pickedMonth || status?.serviceMonth || null;
  const activeLabel =
    status?.availableMonths?.find((m) => m.serviceMonth === activeMonth)?.serviceMonthLabel ||
    status?.serviceMonthLabel ||
    "";

  async function submitDigital() {
    if (!status || !activeMonth || !signature.startsWith("data:image/")) {
      setError("Ask the client to sign before submitting.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/ijp-attestation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceMonth: activeMonth,
        signatureDataUrl: signature,
      }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setMessage("Attestation saved.");
    setSignature("");
    void reload();
  }

  async function submitUpload(file: File) {
    if (!status || !activeMonth) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("File must be 10 MB or smaller.");
      return;
    }
    setBusy(true);
    setError(null);
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
    const base64 = btoa(binary);
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const res = await fetch(`/api/clients/${clientId}/ijp-attestation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isPdf
          ? {
              serviceMonth: activeMonth,
              uploadPdfBase64: base64,
            }
          : {
              serviceMonth: activeMonth,
              uploadImageBase64: base64,
              uploadMimeType: file.type || "image/jpeg",
            }
      ),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setMessage("Signed upload saved.");
    void reload();
  }

  if (loading) {
    return <p className="text-sm text-brand-black/60">Checking IJP attestation…</p>;
  }

  if (!status) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
        {error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : (
          <p className="text-sm text-brand-black/70">
            IJP attestation is not available for this client right now. Refresh the page and try
            again, or open the client profile.
          </p>
        )}
      </div>
    );
  }

  const canCollectSignature = status.captureOpen && !status.hasAttestation;

  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-brand-black">IJP monthly attestation</h3>
        {status.signatureNeeded ? (
          <span
            className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
            title={activeLabel}
          >
            Signature needed
          </span>
        ) : status.hasAttestation ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">
            Received — {activeLabel}
          </span>
        ) : null}
      </div>

      {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      {canPickMonth && (status.availableMonths?.length ?? 0) > 1 ? (
        <label className="mt-3 block text-sm text-brand-black/80">
          Service month for this signature
          <select
            className="mt-1 block rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
            value={activeMonth ?? ""}
            onChange={(e) => {
              const next = e.target.value;
              setPickedMonth(next);
              void reload(next);
            }}
          >
            {(status.availableMonths ?? []).map((m) => (
              <option key={m.serviceMonth} value={m.serviceMonth}>
                {m.serviceMonthLabel}
                {m.serviceMonth === status.serviceMonth ? " (default)" : ""}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-brand-black/55">
            During the prior month&apos;s grace window, signatures default to that prior month.
            Accounts Specialists and Admins can choose the month.
          </span>
        </label>
      ) : (
        <p className="mt-2 text-xs text-brand-black/55">
          Applying to {activeLabel}
          {status.availableMonths && status.availableMonths.length === 1
            ? " (grace-window default when applicable)."
            : "."}
        </p>
      )}

      {canCollectSignature ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed text-brand-black/85">{IJP_ATTESTATION_TEXT}</p>
          {!status.signatureNeeded ? (
            <p className="text-sm text-brand-black/65">
              Billable time for {activeLabel} may not be logged yet. You can still collect the
              client&apos;s signature during the attestation window.
            </p>
          ) : null}
          <SignaturePad
            value={signature}
            onChange={setSignature}
            disabled={busy}
            label="Client signature"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitDigital()}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save IJP signature
            </button>
            <a
              href={`/api/clients/${clientId}/ijp-attestation/blank?month=${encodeURIComponent(activeMonth ?? status.serviceMonth)}`}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-brand-black"
            >
              Download blank PDF
            </a>
            <label className="cursor-pointer rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-brand-black">
              Upload signed scan
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void submitUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      ) : status.hasAttestation ? (
        <p className="mt-2 text-sm text-brand-black/70">
          Attestation on file for {activeLabel}.
        </p>
      ) : status.signatureNeeded ? (
        <p className="mt-2 text-sm text-brand-black/70">
          Capture window closed for {activeLabel}. Signature is still needed for billing.
        </p>
      ) : (
        <p className="mt-2 text-sm text-brand-black/70">
          No attestation required for {activeLabel}.
        </p>
      )}
    </section>
  );
}
