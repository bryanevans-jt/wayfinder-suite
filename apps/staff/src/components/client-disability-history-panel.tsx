"use client";

import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  clientId: string;
  initialValue: string | null;
  canWrite: boolean;
};

export function ClientDisabilityHistoryPanel({ clientId, initialValue, canWrite }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/disability-history`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabilityHistory: value }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(friendlyClientError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void save(e)}
      className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-brand-black">Disability / history</h3>
        <p className="mt-1 text-xs text-brand-black/60">
          From the referral when available. Visible to Joshua Tree staff only — not counselors,
          clients, or natural supports.
        </p>
      </div>
      <label className="block text-sm">
        <span className="sr-only">Disability / history</span>
        <textarea
          rows={5}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          disabled={!canWrite || busy}
          placeholder="Add disability or relevant history from referral or intake…"
          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm disabled:bg-neutral-50"
        />
      </label>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm font-medium text-brand-green">Saved.</p>
      ) : null}
      {canWrite ? (
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save disability / history"}
        </button>
      ) : (
        <p className="text-xs text-brand-black/55">View-only for your role or preview mode.</p>
      )}
    </form>
  );
}
