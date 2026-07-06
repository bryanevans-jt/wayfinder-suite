"use client";

import { friendlyClientError } from "@wayfinder/supabase/error-log";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateClientCurrentStage } from "./actions";

export type MilestoneOption = { id: string; title: string; order_index: number };

type ClientStageFormProps = {
  clientId: string;
  milestones: MilestoneOption[];
  currentStageId: string | null;
};

export function ClientStageForm({
  clientId,
  milestones,
  currentStageId,
}: ClientStageFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(currentStageId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    if (!value) {
      setError("Select a stage");
      return;
    }
    startTransition(async () => {
      try {
        await updateClientCurrentStage(clientId, value);
        router.refresh();
      } catch (e) {
        setError(friendlyClientError(e));
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Current stage
      </h2>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="block text-sm font-medium text-brand-black" htmlFor="stage-select">
            Milestone
          </label>
          <select
            id="stage-select"
            className="mt-1 w-full max-w-md rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
            value={value}
            onChange={(ev) => setValue(ev.target.value)}
          >
            <option value="">Select a milestone</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save stage"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
