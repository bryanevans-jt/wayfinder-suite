"use client";

import { useEffect, useState } from "react";
import { ReferralFieldSpecialistSelect } from "@/components/referral-field-specialist-select";

type Props = {
  clientId: string;
  officeId: string | null;
  initialAssigneeUserId: string | null;
};

export function ReferralDetailAssignPanel({ clientId, officeId, initialAssigneeUserId }: Props) {
  const [assignee, setAssignee] = useState(initialAssigneeUserId ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAssignee(initialAssigneeUserId ?? "");
  }, [initialAssigneeUserId]);

  async function save(userId: string) {
    setAssignee(userId);
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          action: "assign_field_specialist",
          fieldSpecialistUserId: userId,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStatus("Assignment saved.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 max-w-md rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-brand-black">Field specialist</h2>
      <p className="mt-1 text-sm text-brand-black/65">
        Assign an ES or TS before activating. Their regional supervisor is applied automatically.
      </p>
      <div className="mt-3">
        <ReferralFieldSpecialistSelect
          officeId={officeId}
          value={assignee}
          disabled={busy}
          onChange={(userId) => {
            if (userId) void save(userId);
          }}
        />
      </div>
      {status ? <p className="mt-2 text-sm text-brand-black/70">{status}</p> : null}
    </section>
  );
}
