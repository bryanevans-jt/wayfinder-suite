"use client";

import {
  DEFAULT_IJP_ATTESTATION_DOC_ID,
  DEFAULT_IJP_INVOICE_DOC_ID,
} from "@wayfinder/supabase/ijp-billing-settings";
import {
  IJP_ATTESTATION_PLACEHOLDERS,
  IJP_INVOICE_PLACEHOLDERS,
} from "@wayfinder/supabase/ijp-template-placeholders";
import type { IjpBillingSettingsRow } from "@wayfinder/supabase/ijp-billing-settings";
import { USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useState } from "react";

function PlaceholderTable({
  title,
  placeholders,
}: {
  title: string;
  placeholders: { token: string; description: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-brand-black">{title}</h3>
      <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-2 py-1.5 font-medium">Token</th>
              <th className="px-2 py-1.5 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {placeholders.map((row) => (
              <tr key={row.token} className="border-t border-neutral-100">
                <td className="px-2 py-1.5 font-mono text-[11px]">{`{{${row.token}}}`}</td>
                <td className="px-2 py-1.5 text-brand-black/75">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function IjpBillingSettingsPanel() {
  const [settings, setSettings] = useState<IjpBillingSettingsRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/ijp-billing-settings");
    const data = (await res.json()) as { settings?: IjpBillingSettingsRow; error?: string };
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setSettings(data.settings ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: Partial<IjpBillingSettingsRow>) {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/ijp-billing-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as { settings?: IjpBillingSettingsRow; error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setSettings(data.settings ?? settings);
    setMessage("Settings saved.");
  }

  async function testFolder(folderId: string | null | undefined) {
    if (!folderId?.trim()) {
      setError("Enter a folder ID first.");
      return;
    }
    const res = await fetch("/api/admin/ijp-billing-settings/test-drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    const data = (await res.json()) as { ok?: boolean; name?: string; error?: string };
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setMessage(`Drive folder OK: ${data.name ?? folderId}`);
  }

  if (!settings) {
    return <p className="text-sm text-brand-black/60">Loading IJP billing settings…</p>;
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">IJP Billing &amp; Attestation</h2>
        <p className="mt-1 text-sm text-brand-black/70">
          Google Doc templates, Drive folders, and hourly rate. Use test folders for the billing
          workspace test mode — production client flags ignore test rows.
        </p>
      </div>

      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.module_enabled}
            onChange={(e) => void save({ module_enabled: e.target.checked })}
          />
          Module enabled
        </label>
        <label className="block text-sm">
          <span className="font-medium">Hourly rate (cents)</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={settings.hourly_rate_cents}
            onChange={(e) =>
              setSettings({ ...settings, hourly_rate_cents: Number(e.target.value) || 0 })
            }
            onBlur={() => void save({ hourly_rate_cents: settings.hourly_rate_cents })}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Invoice Google Doc ID</span>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
            value={settings.template_invoice_doc_id ?? DEFAULT_IJP_INVOICE_DOC_ID}
            onChange={(e) =>
              setSettings({ ...settings, template_invoice_doc_id: e.target.value || null })
            }
            onBlur={() => void save({ template_invoice_doc_id: settings.template_invoice_doc_id })}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Attestation Google Doc ID</span>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
            value={settings.template_attestation_doc_id ?? DEFAULT_IJP_ATTESTATION_DOC_ID}
            onChange={(e) =>
              setSettings({ ...settings, template_attestation_doc_id: e.target.value || null })
            }
            onBlur={() =>
              void save({ template_attestation_doc_id: settings.template_attestation_doc_id })
            }
          />
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="text-sm font-semibold">Production Drive folders</h3>
        {(
          [
            ["drive_attestation_folder_id", "Attestations"],
            ["drive_invoice_folder_id", "Invoices (combined packets)"],
            ["drive_signature_temp_folder_id", "Signature temp (inline images)"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex flex-wrap items-end gap-2">
            <label className="flex-1 text-sm">
              <span className="font-medium">{label}</span>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
                value={(settings[key] as string) ?? ""}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value || null })}
                onBlur={() => void save({ [key]: settings[key] })}
              />
            </label>
            <button
              type="button"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              onClick={() => void testFolder(settings[key] as string)}
            >
              Test
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <h3 className="text-sm font-semibold text-amber-950">Test Drive folders (sandbox)</h3>
        <p className="text-xs text-amber-900/80">
          Billing workspace test runs write here only. They do not update Signature needed flags or
          SLA alerts.
        </p>
        {(
          [
            ["drive_test_attestation_folder_id", "Test attestations"],
            ["drive_test_invoice_folder_id", "Test invoices"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex flex-wrap items-end gap-2">
            <label className="flex-1 text-sm">
              <span className="font-medium">{label}</span>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
                value={(settings[key] as string) ?? ""}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value || null })}
                onBlur={() => void save({ [key]: settings[key] })}
              />
            </label>
            <button
              type="button"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              onClick={() => void testFolder(settings[key] as string)}
            >
              Test
            </button>
          </div>
        ))}
      </section>

      <PlaceholderTable title="Invoice template tokens" placeholders={IJP_INVOICE_PLACEHOLDERS} />
      <PlaceholderTable
        title="Attestation template tokens"
        placeholders={IJP_ATTESTATION_PLACEHOLDERS}
      />

      {saving ? <p className="text-xs text-brand-black/50">Saving…</p> : null}
    </div>
  );
}
