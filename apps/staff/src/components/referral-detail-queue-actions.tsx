"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReferralFieldSpecialistSelect } from "@/components/referral-field-specialist-select";

type Props = {
  clientId: string;
  officeId: string | null;
  intakeStatus: string;
  authorizationNumber: string | null;
  directReferralAssignEnabled: boolean;
  canAssignFieldSpecialist: boolean;
  initialAssigneeUserId: string | null;
};

export function ReferralDetailQueueActions({
  clientId,
  officeId,
  intakeStatus,
  authorizationNumber,
  directReferralAssignEnabled,
  canAssignFieldSpecialist,
  initialAssigneeUserId,
}: Props) {
  const router = useRouter();
  const [authNumber, setAuthNumber] = useState(authorizationNumber ?? "");
  const [overrideReason, setOverrideReason] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState(initialAssigneeUserId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const queueOpen =
    intakeStatus === "new_referral" || intakeStatus === "pending_authorization";

  const authReady = Boolean(authNumber.trim() || overrideReason.trim());
  const assigneeReady = !directReferralAssignEnabled || Boolean(assigneeUserId.trim());

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, ...body }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Action failed");
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveAuth() {
    const ok = await patch({
      action: "update_info",
      info: {
        authorizationNumber: authNumber.trim() || null,
      },
    });
    if (ok) setSaved(true);
  }

  if (intakeStatus === "discarded") {
    return null;
  }

  if (!queueOpen) {
    return (
      <p className="text-sm text-brand-black/65">
        This referral is no longer in the queue (status: {intakeStatus}).
      </p>
    );
  }

  return (
    <section className="mt-6 max-w-3xl space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
      <h2 className="text-lg font-semibold text-brand-black">Referral queue actions</h2>
      <p className="text-sm text-brand-black/65">
        Same actions as the Referral Queue list—save authorization, assign ES/TS, and activate.
      </p>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm font-medium text-brand-green">Authorization saved.</p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">Authorization #</span>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2"
            value={authNumber}
            onChange={(e) => setAuthNumber(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Activate override reason</span>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2"
            placeholder="If no authorization #"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
        </label>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void saveAuth()}
        className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        Save authorization
      </button>

      {canAssignFieldSpecialist ? (
        <div className="max-w-md">
          <ReferralFieldSpecialistSelect
            officeId={officeId}
            value={assigneeUserId}
            disabled={busy}
            onChange={(userId) => {
              setAssigneeUserId(userId);
              if (userId) {
                void patch({
                  action: "assign_field_specialist",
                  fieldSpecialistUserId: userId,
                });
              }
            }}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ action: "pending_authorization" })}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          Pending Authorization
        </button>
        <button
          type="button"
          disabled={busy || !authReady || !assigneeReady}
          onClick={() =>
            void patch({
              action: "activate",
              authorizationNumber: authNumber,
              overrideReason: overrideReason,
            })
          }
          className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-50"
        >
          Activate First Stage
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (confirm("Discard this referral client?")) {
              void patch({ action: "discard" });
            }
          }}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
        >
          Discard
        </button>
      </div>
    </section>
  );
}
