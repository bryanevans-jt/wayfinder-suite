"use client";

import { useEffect, useState } from "react";

type RosterRow = {
  participantId: string;
  fullName: string;
  unitsApproved: number;
};

type Props = {
  authorizationId: string;
  schoolLabel: string;
  mode?: "finalize" | "edit";
  onClose: () => void;
  onSaved: () => void;
};

export function PreEtsAuthorizationFinalizeModal({
  authorizationId,
  schoolLabel,
  mode = "finalize",
  onClose,
  onSaved,
}: Props) {
  const isEdit = mode === "edit";
  const [authNumber, setAuthNumber] = useState("");
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/pre-ets/authorizations/${authorizationId}/roster`);
      const data = (await res.json()) as {
        roster?: Array<{
          participantId: string | null;
          fullName: string | null;
          unitsApproved: number | null;
        }>;
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "Could not load roster");
        setLoading(false);
        return;
      }
      setRows(
        (data.roster ?? []).map((r) => ({
          participantId: r.participantId ?? "",
          fullName: r.fullName ?? "",
          unitsApproved: r.unitsApproved ?? 0,
        }))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authorizationId]);

  function updateRow(index: number, patch: Partial<RosterRow>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { participantId: "", fullName: "", unitsApproved: 0 },
    ]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(
      isEdit
        ? `/api/pre-ets/authorizations/${authorizationId}/roster`
        : `/api/pre-ets/authorizations/${authorizationId}/finalize`,
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { roster: rows } : { authNumber, roster: rows }),
      }
    );
    const data = (await res.json()) as { error?: string; ytdWarnings?: unknown[] };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-brand-black">
          {isEdit ? "Edit roster" : "Enter authorization"}
        </h2>
        <p className="mt-1 text-sm text-brand-black/70">{schoolLabel}</p>
        <p className="mt-2 text-xs text-brand-black/60">
          {isEdit
            ? "Update students imported from the spreadsheet. Changes apply to the pending authorization only."
            : "Add or remove students as needed. Saving finalizes this roster and notifies the assigned TS/TI and supervisor that it is ready."}
        </p>

        {!isEdit ? (
          <label className="mt-4 block text-sm">
            <span className="font-medium">GVRA authorization number</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
              value={authNumber}
              onChange={(e) => setAuthNumber(e.target.value)}
              disabled={saving}
            />
          </label>
        ) : null}

        {loading ? (
          <p className="mt-6 text-sm text-brand-black/60">Loading roster…</p>
        ) : (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Roster students</p>
              <button
                type="button"
                className="text-sm text-brand-green hover:underline"
                onClick={addRow}
                disabled={saving}
              >
                Add student
              </button>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-brand-black/60">No students yet — add at least one.</p>
            ) : (
              rows.map((row, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-lg border border-neutral-200 p-3 sm:grid-cols-[1fr_1fr_80px_auto]"
                >
                  <input
                    placeholder="Participant ID"
                    className="rounded border border-neutral-300 px-2 py-1 text-sm"
                    value={row.participantId}
                    onChange={(e) => updateRow(index, { participantId: e.target.value })}
                    disabled={saving}
                  />
                  <input
                    placeholder="Student name"
                    className="rounded border border-neutral-300 px-2 py-1 text-sm"
                    value={row.fullName}
                    onChange={(e) => updateRow(index, { fullName: e.target.value })}
                    disabled={saving}
                  />
                  <input
                    type="number"
                    min={0}
                    className="rounded border border-neutral-300 px-2 py-1 text-sm"
                    value={row.unitsApproved}
                    onChange={(e) =>
                      updateRow(index, { unitsApproved: Number(e.target.value) || 0 })
                    }
                    disabled={saving}
                  />
                  <button
                    type="button"
                    className="text-sm text-red-700 hover:underline"
                    onClick={() => removeRow(index)}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => void save()}
            disabled={
              saving || loading || rows.length === 0 || (!isEdit && !authNumber.trim())
            }
          >
            {saving ? "Saving…" : isEdit ? "Save roster" : "Finalize roster"}
          </button>
        </div>
      </div>
    </div>
  );
}
