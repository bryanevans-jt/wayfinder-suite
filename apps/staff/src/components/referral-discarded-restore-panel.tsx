"use client";

import { intakeStatusLabel } from "@wayfinder/supabase/referral-labels";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  clientId: string;
};

export function ReferralDiscardedRestorePanel({ clientId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    if (
      !confirm(
        "Restore this referral? It will reappear in the Referral Queue based on its prior intake status (usually Active if already activated)."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, action: "restore" }),
      });
      const data = (await res.json()) as { error?: string; intakeStatus?: string };
      if (!res.ok) throw new Error(data.error || "Could not restore");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 max-w-3xl rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h2 className="text-lg font-semibold text-brand-black">Discarded referral</h2>
      <p className="mt-2 text-sm text-amber-950">
        This client was marked <strong>{intakeStatusLabel("discarded")}</strong>, so they are hidden
        from the Referral Queue and ES caseload rules that depend on intake status. Restore to undo
        the discard if it was a mistake.
      </p>
      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void restore()}
        className="mt-4 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-50"
      >
        {busy ? "Restoring…" : "Restore referral"}
      </button>
    </section>
  );
}
