"use client";

import { PreEtsServiceCodeDisplay } from "@/components/pre-ets-service-code-display";
import type { PreEtsServiceCodeRow } from "@wayfinder/supabase/pre-ets-settings";
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
  canEditServiceCode?: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function PreEtsAuthorizationFinalizeModal({
  authorizationId,
  schoolLabel,
  mode = "finalize",
  canEditServiceCode = false,
  onClose,
  onSaved,
}: Props) {
  const isEdit = mode === "edit";
  const [authNumber, setAuthNumber] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [serviceLabel, setServiceLabel] = useState<string | null>(null);
  const [serviceCodeOptions, setServiceCodeOptions] = useState<PreEtsServiceCodeRow[]>([]);
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const [rosterRes, accessRes] = await Promise.all([
        fetch(`/api/pre-ets/authorizations/${authorizationId}/roster`),
        canEditServiceCode ? fetch("/api/pre-ets/access") : Promise.resolve(null),
      ]);
      const data = (await rosterRes.json()) as {
        roster?: Array<{
          participantId: string | null;
          fullName: string | null;
          unitsApproved: number | null;
        }>;
        authorization?: {
          serviceCode: string;
          serviceLabel: string | null;
        } | null;
        error?: string;
      };
      if (cancelled) return;
      if (!rosterRes.ok) {
        setError(data.error ?? "Could not load roster");
        setLoading(false);
        return;
      }
      setServiceCode(data.authorization?.serviceCode ?? "");
      setServiceLabel(data.authorization?.serviceLabel ?? null);
      setRows(
        (data.roster ?? []).map((r) => ({
          participantId: r.participantId ?? "",
          fullName: r.fullName ?? "",
          unitsApproved: r.unitsApproved ?? 0,
        }))
      );
      if (accessRes?.ok) {
        const accessData = (await accessRes.json()) as {
          settings?: { service_codes?: PreEtsServiceCodeRow[] };
        };
        setServiceCodeOptions(accessData.settings?.service_codes ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authorizationId, canEditServiceCode]);

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

    if (canEditServiceCode && serviceCode.trim()) {
      const codeRes = await fetch(`/api/pre-ets/authorizations/${authorizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceCode: serviceCode.trim(), serviceLabel }),
      });
      const codeData = (await codeRes.json()) as { error?: string; serviceLabel?: string | null };
      if (!codeRes.ok) {
        setSaving(false);
        setError(codeData.error ?? "Could not update service code.");
        return;
      }
      if (codeData.serviceLabel !== undefined) {
        setServiceLabel(codeData.serviceLabel ?? null);
      }
    }

    const res = await fetch(
      isEdit
        ? `/api/pre-ets/authorizations/${authorizationId}/roster`
        : `/api/pre-ets/authorizations/${authorizationId}/finalize`,
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { roster: rows }
            : {
                authNumber,
                roster: rows,
                ...(canEditServiceCode && serviceCode.trim()
                  ? { serviceCode: serviceCode.trim(), serviceLabel }
                  : {}),
              }
        ),
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

        <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
          <span className="font-medium text-brand-black">Service code</span>
          {canEditServiceCode ? (
            serviceCodeOptions.length > 0 ? (
              <select
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
                value={serviceCode}
                disabled={saving || loading}
                onChange={(e) => {
                  const code = e.target.value;
                  setServiceCode(code);
                  const match = serviceCodeOptions.find((row) => row.code === code);
                  setServiceLabel(match?.description ?? match?.service ?? null);
                }}
              >
                <option value="">Select code…</option>
                {serviceCodeOptions.map((row) => (
                  <option key={row.code} value={row.code}>
                    {row.code}
                    {row.description ? ` — ${row.description}` : row.service ? ` — ${row.service}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
                value={serviceCode}
                disabled={saving || loading}
                onChange={(e) => setServiceCode(e.target.value)}
              />
            )
          ) : (
            <p className="mt-1">
              <PreEtsServiceCodeDisplay code={serviceCode} label={serviceLabel} prominent />
            </p>
          )}
          {!canEditServiceCode ? (
            <p className="mt-1 text-xs text-brand-black/55">
              Only Accounts Specialist, Admin, or Super Admin can change the service code.
            </p>
          ) : null}
        </div>

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
