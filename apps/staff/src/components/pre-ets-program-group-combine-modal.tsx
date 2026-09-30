"use client";

import { useState } from "react";

type CombineCandidate = {
  programGroupId: string;
  groupName: string;
  instructorName: string | null;
};

export function PreEtsProgramGroupCombineModal(props: {
  open: boolean;
  sourceProgramGroupId: string | null;
  sourceLabel: string;
  candidates: CombineCandidate[];
  onClose: () => void;
  onCombined: () => void;
}) {
  const { open, sourceProgramGroupId, sourceLabel, candidates, onClose, onCombined } = props;
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !sourceProgramGroupId) return null;

  const options = candidates.filter((c) => c.programGroupId !== sourceProgramGroupId);

  async function submit() {
    if (!targetId) {
      setError("Choose the group to keep.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/pre-ets/program-groups/${sourceProgramGroupId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetProgramGroupId: targetId }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not combine groups");
      return;
    }
    setTargetId("");
    onCombined();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-lg"
        role="dialog"
        aria-labelledby="combine-groups-title"
      >
        <h2 id="combine-groups-title" className="text-lg font-semibold text-brand-black">
          Combine groups
        </h2>
        <p className="mt-2 text-sm text-brand-black/70">
          Move authorizations and rosters from <strong>{sourceLabel}</strong> into another group at
          the same school, then hide the source group. A future worksheet upload with that header
          and student PIDs can show it again.
        </p>
        <label className="mt-4 block text-sm">
          <span className="font-medium">Keep this group (combine into)</span>
          <select
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">Select group…</option>
            {options.map((c) => (
              <option key={c.programGroupId} value={c.programGroupId}>
                {c.groupName}
                {c.instructorName ? ` · ${c.instructorName}` : ""}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-brand-gold px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Combining…" : "Combine"}
          </button>
        </div>
      </div>
    </div>
  );
}
