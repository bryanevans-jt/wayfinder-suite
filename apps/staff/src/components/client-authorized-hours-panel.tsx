"use client";

import { displayServiceCatalogName } from "@wayfinder/branding";
import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  clientId: string;
  serviceName: string | null;
  initialAuthorizedHours: number | null;
  initialAuthorizationEndDate: string | null;
  canWrite: boolean;
};

export function ClientAuthorizedHoursPanel({
  clientId,
  serviceName,
  initialAuthorizedHours,
  initialAuthorizationEndDate,
  canWrite,
}: Props) {
  const router = useRouter();
  const [authorizedHours, setAuthorizedHours] = useState(
    initialAuthorizedHours == null || Number.isNaN(Number(initialAuthorizedHours))
      ? ""
      : String(initialAuthorizedHours)
  );
  const [authorizationEndDate, setAuthorizationEndDate] = useState(
    (initialAuthorizationEndDate ?? "").slice(0, 10)
  );
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
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/authorized-hours`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorizedHours,
          authorizationEndDate,
        }),
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

  const serviceLabel = displayServiceCatalogName(serviceName) || "this service";

  return (
    <form
      onSubmit={(e) => void save(e)}
      className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-brand-black">Authorization hours</h3>
        <p className="mt-1 text-xs text-brand-black/60">
          Optional VR authorized hours and end date for {serviceLabel}. Visible to the assigned
          Employment Specialist or Transition Specialist and staff who can view referral or client
          profile data.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-brand-black/80">Authorized hours</span>
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={authorizedHours}
            onChange={(e) => {
              setAuthorizedHours(e.target.value);
              setSaved(false);
            }}
            disabled={!canWrite || busy}
            placeholder="e.g. 40"
            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm disabled:bg-neutral-50"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-brand-black/80">Authorization end date</span>
          <input
            type="date"
            value={authorizationEndDate}
            onChange={(e) => {
              setAuthorizationEndDate(e.target.value);
              setSaved(false);
            }}
            disabled={!canWrite || busy}
            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm disabled:bg-neutral-50"
          />
        </label>
      </div>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-sm font-medium text-brand-green">Saved.</p> : null}
      {canWrite ? (
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save authorization hours"}
        </button>
      ) : null}
    </form>
  );
}
