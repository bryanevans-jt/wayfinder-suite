"use client";

import { useEffect, useState } from "react";

type Props = {
  programGroupId: string;
  initialSchoolName: string;
  initialGroupName: string;
  initialInstructorName: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function PreEtsProgramGroupLabelsModal({
  programGroupId,
  initialSchoolName,
  initialGroupName,
  initialInstructorName,
  onClose,
  onSaved,
}: Props) {
  const [schoolName, setSchoolName] = useState(initialSchoolName);
  const [groupName, setGroupName] = useState(initialGroupName);
  const [instructorName, setInstructorName] = useState(initialInstructorName ?? "");
  const [headerRaw, setHeaderRaw] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/pre-ets/program-groups/${programGroupId}`);
      const data = (await res.json()) as {
        programGroup?: { headerRaw?: string; schoolName?: string; groupName?: string; instructorName?: string | null };
      };
      if (res.ok && data.programGroup) {
        setHeaderRaw(data.programGroup.headerRaw ?? null);
        setSchoolName(data.programGroup.schoolName ?? initialSchoolName);
        setGroupName(data.programGroup.groupName ?? initialGroupName);
        setInstructorName(data.programGroup.instructorName ?? initialInstructorName ?? "");
      }
    })();
  }, [programGroupId, initialGroupName, initialInstructorName, initialSchoolName]);

  async function onSave() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/pre-ets/program-groups/${programGroupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolName,
        groupName,
        instructorName: instructorName.trim() || null,
        rememberForFutureImports: remember,
      }),
    });
    const data = (await res.json()) as { error?: string; mappingSaved?: boolean };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-labelledby="pg-labels-title"
      >
        <h2 id="pg-labels-title" className="text-lg font-semibold text-brand-black">
          Edit school, group, and instructor
        </h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Fix labels shown in Pre-ETS. When &quot;Remember for future uploads&quot; is checked, the app
          matches the same spreadsheet header line on later imports and applies these names
          automatically.
        </p>

        {headerRaw ? (
          <p className="mt-3 rounded-lg bg-neutral-50 p-2 text-xs text-brand-black/70">
            <span className="font-medium">Spreadsheet header:</span> {headerRaw}
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-medium">School name</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Group name</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Instructor</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Remember for future uploads (same spreadsheet header line in this district)</span>
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => void onSave()}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
