"use client";

import { USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useState } from "react";

type Props = {
  clientId: string;
  serviceMonth: string;
  onDismissed?: () => void;
};

export function DismissIjpAttestationSlaButton({ clientId, serviceMonth, onDismissed }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dismiss() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/ijp-attestation/dismiss-sla", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, serviceMonth }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    onDismissed?.();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void dismiss()}
        className="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-medium text-brand-black/80 hover:bg-neutral-50 disabled:opacity-50"
        title="Hides SLA/compliance alerts only; Signature needed on caseload remains until attestation is captured."
      >
        {busy ? "Dismissing…" : "Dismiss SLA alert"}
      </button>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
