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
};

type Props = {
  clientId: string;
};

export function IjpClientSignatureSection({ clientId }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/ijp-attestation`);
    const data = (await res.json()) as { status?: Status | null; error?: string };
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      setStatus(null);
    } else {
      setStatus(data.status ?? null);
      setError(null);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submitDigital() {
    if (!status || !signature.startsWith("data:image/")) {
      setError("Ask the client to sign before submitting.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/ijp-attestation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceMonth: status.serviceMonth,
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
    if (!status) return;
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
              serviceMonth: status.serviceMonth,
              uploadPdfBase64: base64,
            }
          : {
              serviceMonth: status.serviceMonth,
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
    return null;
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-brand-black">Client Signature (IJP)</h3>
        {status.signatureNeeded ? (
          <span
            className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
            title={status.serviceMonthLabel}
          >
            Signature needed
          </span>
        ) : status.hasAttestation ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">
            Received — {status.serviceMonthLabel}
          </span>
        ) : null}
      </div>

      {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      {status.signatureNeeded && status.captureOpen ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed text-brand-black/85">{IJP_ATTESTATION_TEXT}</p>
          <SignaturePad value={signature} onChange={setSignature} disabled={busy} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitDigital()}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Submit client signature
            </button>
            <a
              href={`/api/clients/${clientId}/ijp-attestation/blank?month=${encodeURIComponent(status.serviceMonth)}`}
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
          Attestation on file for {status.serviceMonthLabel}.
        </p>
      ) : (
        <p className="mt-2 text-sm text-brand-black/70">
          Capture window closed for {status.serviceMonthLabel}.
        </p>
      )}
    </section>
  );
}
