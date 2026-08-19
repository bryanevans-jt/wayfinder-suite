"use client";

import { useEffect, useState } from "react";
import {
  formatPreEtsRateDollars,
  type PreEtsInvoiceExportMode,
  type PreEtsServiceCodeRow,
  type PreEtsSettingsRow,
} from "@wayfinder/supabase/pre-ets-settings";
import {
  formatPreEtsPlaceholderToken,
  PRE_ETS_CAR_PLACEHOLDERS,
  PRE_ETS_DEFAULT_DRIVE_PATH_TEMPLATE,
  PRE_ETS_DRIVE_PATH_TOKENS,
  PRE_ETS_INVOICE_PLACEHOLDERS,
  PRE_ETS_ROSTER_CORE_PLACEHOLDERS,
  PRE_ETS_ROSTER_ROW_PLACEHOLDER_NOTE,
  type PreEtsTemplatePlaceholder,
} from "@wayfinder/supabase/pre-ets-template-placeholders";
import { roleDisplayName } from "@wayfinder/supabase/roles";

type RolloutRole = string;

type ApiResponse = {
  settings?: PreEtsSettingsRow;
  rolloutRoles?: RolloutRole[];
};

const ROLLOUT_ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  accountant: "Accounts Specialist",
  supervisor: "Supervisor",
  es: "Employment Specialist",
  instructor: "Instructor",
  hr: "HR Director",
};

function emptyServiceCode(): PreEtsServiceCodeRow {
  return { code: "", service: "", description: "" };
}

function PlaceholderReferenceTable({
  title,
  note,
  placeholders,
}: {
  title: string;
  note?: string;
  placeholders: PreEtsTemplatePlaceholder[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-brand-black">{title}</h3>
      {note ? <p className="mt-1 text-xs text-brand-black/60">{note}</p> : null}
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
                <td className="px-2 py-1.5 font-mono text-[11px]">
                  {formatPreEtsPlaceholderToken(row.token)}
                </td>
                <td className="px-2 py-1.5 text-brand-black/75">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PreEtsSettingsPanel() {
  const [settings, setSettings] = useState<PreEtsSettingsRow | null>(null);
  const [rolloutRoles, setRolloutRoles] = useState<RolloutRole[]>([]);
  const [rateDollars, setRateDollars] = useState("90.00");
  const [serviceCodes, setServiceCodes] = useState<PreEtsServiceCodeRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [driveTestMessage, setDriveTestMessage] = useState<string | null>(null);

  async function testDriveFolder(folderId: string | null) {
    setDriveTestMessage(null);
    if (!folderId?.trim()) {
      setDriveTestMessage("Enter a folder ID first.");
      return;
    }
    const res = await fetch("/api/admin/pre-ets-settings/test-drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    const data = (await res.json()) as { folderName?: string; error?: string };
    setDriveTestMessage(
      res.ok ? `Connected: ${data.folderName}` : data.error ?? "Drive test failed."
    );
  }

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/pre-ets-settings");
      const data = (await res.json()) as ApiResponse;
      if (res.ok && data.settings) {
        setSettings(data.settings);
        setRateDollars(formatPreEtsRateDollars(data.settings.default_rate_cents));
        setServiceCodes(
          data.settings.service_codes.length > 0
            ? data.settings.service_codes
            : [emptyServiceCode()]
        );
        setRolloutRoles(data.rolloutRoles ?? []);
      }
    })();
  }, []);

  function toggleRole(role: string) {
    if (!settings) return;
    if (role === "super_admin") return;
    const enabled = new Set(settings.enabled_roles);
    if (enabled.has(role)) {
      enabled.delete(role);
    } else {
      enabled.add(role);
    }
    enabled.add("super_admin");
    setSettings({ ...settings, enabled_roles: [...enabled] });
  }

  function updateServiceCode(index: number, patch: Partial<PreEtsServiceCodeRow>) {
    setServiceCodes((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/pre-ets-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settings,
        default_rate_dollars: rateDollars,
        service_codes: serviceCodes.filter((row) => row.code.trim()),
      }),
    });
    const data = (await res.json()) as { settings?: PreEtsSettingsRow; error?: string };
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error ?? "Could not save Pre-ETS settings.");
      return;
    }
    if (data.settings) {
      setSettings(data.settings);
      setRateDollars(formatPreEtsRateDollars(data.settings.default_rate_cents));
      setServiceCodes(
        data.settings.service_codes.length > 0
          ? data.settings.service_codes
          : [emptyServiceCode()]
      );
    }
    setMessage("Pre-ETS settings saved.");
  }

  if (!settings) {
    return <p className="mt-6 text-sm text-brand-black/60">Loading Pre-ETS settings…</p>;
  }

  return (
    <div className="mt-6 max-w-3xl space-y-8">
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-black">Pre-ETS Access &amp; Rollout</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Pre-ETS is hidden from all roles except those checked below. Super Admin is always
          enabled. Admin and Accounts Specialist inherit billing functions when enabled.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.module_enabled}
            onChange={(e) => setSettings({ ...settings, module_enabled: e.target.checked })}
          />
          <span className="font-medium">Pre-ETS module enabled</span>
        </label>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(rolloutRoles.length > 0 ? rolloutRoles : Object.keys(ROLLOUT_ROLE_LABELS)).map(
            (role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.enabled_roles.includes(role)}
                  disabled={role === "super_admin"}
                  onChange={() => toggleRole(role)}
                />
                <span>
                  {ROLLOUT_ROLE_LABELS[role] ?? roleDisplayName(role)}
                  {role === "super_admin" ? " (always on)" : ""}
                </span>
              </label>
            )
          )}
        </div>
        <label className="mt-4 block text-sm">
          <span className="font-medium">Active school year</span>
          <input
            className="mt-1 block w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2"
            value={settings.school_year}
            onChange={(e) => setSettings({ ...settings, school_year: e.target.value })}
          />
        </label>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-black">Google Drive Folders</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Folder IDs for signed roster uploads, invoice archives, and worksheet imports. Uses the
          same Google service account as Joshua Tree Reports.
        </p>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            <span className="font-medium">Signed roster upload folder ID</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                className="min-w-[240px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
                value={settings.drive_signed_roster_folder_id ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    drive_signed_roster_folder_id: e.target.value || null,
                  })
                }
                placeholder="Google Drive folder ID"
              />
              <button
                type="button"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium"
                onClick={() =>
                  void testDriveFolder(settings.drive_signed_roster_folder_id)
                }
              >
                Test
              </button>
            </div>
          </label>
          <label className="block">
            <span className="font-medium">Invoice packet archive folder ID</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                className="min-w-[240px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
                value={settings.drive_invoice_archive_folder_id ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    drive_invoice_archive_folder_id: e.target.value || null,
                  })
                }
              />
              <button
                type="button"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium"
                onClick={() =>
                  void testDriveFolder(settings.drive_invoice_archive_folder_id)
                }
              >
                Test
              </button>
            </div>
          </label>
          <label className="block">
            <span className="font-medium">Worksheet import archive folder ID</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                className="min-w-[240px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
                value={settings.drive_worksheet_archive_folder_id ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    drive_worksheet_archive_folder_id: e.target.value || null,
                  })
                }
              />
              <button
                type="button"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium"
                onClick={() =>
                  void testDriveFolder(settings.drive_worksheet_archive_folder_id)
                }
              >
                Test
              </button>
            </div>
          </label>
          {driveTestMessage ? (
            <p className="text-xs text-brand-black/65">{driveTestMessage}</p>
          ) : null}
          <label className="block">
            <span className="font-medium">Folder path template</span>
            <input
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
              value={settings.drive_folder_path_template}
              onChange={(e) =>
                setSettings({ ...settings, drive_folder_path_template: e.target.value })
              }
              placeholder="Pre-ETS/{SchoolYear}/{Month}/{School}/{AuthNumber}"
            />
            <p className="mt-1 text-xs text-brand-black/55">
              Creates nested subfolders under each configured root folder. Tokens:{" "}
              <code className="font-mono">{"{SchoolYear}"}</code>, <code className="font-mono">{"{Month}"}</code>,{" "}
              <code className="font-mono">{"{School}"}</code>, <code className="font-mono">{"{AuthNumber}"}</code>.
            </p>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-black">PDF Templates</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Google Doc template IDs or file references for generated paperwork.
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {(
            [
              ["template_roster_doc_id", "Blank roster (Time Sheet)"],
              ["template_car_doc_id", "Class Activity Report"],
              ["template_invoice_cover_doc_id", "Invoice cover sheet"],
              ["template_invoice_attestation_doc_id", "Invoice attestation page"],
              ["template_individual_roster_doc_id", "Individual auth roster"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="font-medium">{label}</span>
              <input
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
                value={settings[key] ?? ""}
                onChange={(e) =>
                  setSettings({ ...settings, [key]: e.target.value || null })
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-black">Template placeholder reference</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Copy these tokens into your Google Doc templates before pasting document IDs above. The
          canonical list also lives in{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[11px]">
            packages/supabase/src/pre-ets-template-placeholders.ts
          </code>
          .
        </p>
        <div className="mt-4 space-y-6">
          <PlaceholderReferenceTable
            title="Roster templates"
            note={`Blank roster, individual auth roster, and session sign-in sheets. ${PRE_ETS_ROSTER_ROW_PLACEHOLDER_NOTE}`}
            placeholders={PRE_ETS_ROSTER_CORE_PLACEHOLDERS}
          />
          <PlaceholderReferenceTable
            title="Invoice cover & attestation"
            placeholders={PRE_ETS_INVOICE_PLACEHOLDERS}
          />
          <PlaceholderReferenceTable
            title="Class Activity Report"
            note="Export from Sessions & reports after submitting a CAR. Requires template_car_doc_id in settings."
            placeholders={PRE_ETS_CAR_PLACEHOLDERS}
          />
          <div>
            <h3 className="text-sm font-semibold text-brand-black">Drive folder path</h3>
            <p className="mt-1 text-xs text-brand-black/60">
              Use single braces in the path template field (not double). Default:{" "}
              <code className="font-mono">{PRE_ETS_DEFAULT_DRIVE_PATH_TEMPLATE}</code>
            </p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-neutral-50 text-brand-black/70">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Token</th>
                    <th className="px-2 py-1.5 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {PRE_ETS_DRIVE_PATH_TOKENS.map((row) => (
                    <tr key={row.token} className="border-t border-neutral-100">
                      <td className="px-2 py-1.5 font-mono text-[11px]">{`{${row.token}}`}</td>
                      <td className="px-2 py-1.5 text-brand-black/75">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-black">Billing Defaults</h2>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <label className="block">
            <span className="font-medium">Default rate per unit ($)</span>
            <input
              type="text"
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={rateDollars}
              onChange={(e) => setRateDollars(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="font-medium">YTD unit warning threshold</span>
            <input
              type="number"
              min={1}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={settings.ytd_unit_warning_threshold}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ytd_unit_warning_threshold: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium">Provider name</span>
            <input
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={settings.provider_name}
              onChange={(e) => setSettings({ ...settings, provider_name: e.target.value })}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium">Remit address</span>
            <input
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={settings.remit_address}
              onChange={(e) => setSettings({ ...settings, remit_address: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="font-medium">Invoice export mode</span>
            <select
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={settings.invoice_export_mode}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  invoice_export_mode: e.target.value as PreEtsInvoiceExportMode,
                })
              }
            >
              <option value="both">Combined PDF and section export</option>
              <option value="combined_pdf">Combined PDF only</option>
              <option value="sections_only">Section export only</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-black">Service Codes</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          GVRA service codes used on invoices and rosters. Add descriptions during build.
        </p>
        <div className="mt-4 space-y-3">
          {serviceCodes.map((row, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg border border-neutral-100 bg-neutral-50 p-3 sm:grid-cols-3"
            >
              <input
                className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                placeholder="Code"
                value={row.code}
                onChange={(e) => updateServiceCode(index, { code: e.target.value })}
              />
              <input
                className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                placeholder="Service (short)"
                value={row.service}
                onChange={(e) => updateServiceCode(index, { service: e.target.value })}
              />
              <input
                className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm sm:col-span-1"
                placeholder="Description"
                value={row.description}
                onChange={(e) => updateServiceCode(index, { description: e.target.value })}
              />
            </div>
          ))}
          <button
            type="button"
            className="text-sm font-medium text-brand-green hover:underline"
            onClick={() => setServiceCodes((rows) => [...rows, emptyServiceCode()])}
          >
            + Add service code
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-black">Compliance &amp; Import</h2>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <label className="block">
            <span className="font-medium">Submission deadline (hours)</span>
            <input
              type="number"
              min={1}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={settings.submission_deadline_hours}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  submission_deadline_hours: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="block">
            <span className="font-medium">Group auth digit count</span>
            <input
              type="number"
              min={1}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={settings.group_auth_digit_count}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  group_auth_digit_count: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium">NOT APPROVED marker text</span>
            <input
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={settings.not_approved_marker}
              onChange={(e) =>
                setSettings({ ...settings, not_approved_marker: e.target.value })
              }
            />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Pre-ETS settings"}
        </button>
        <a
          href="/dashboard/pre-ets"
          className="rounded-lg border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green hover:bg-brand-green/5"
        >
          Open Pre-ETS workspace
        </a>
        {message ? <p className="text-sm text-brand-black/70">{message}</p> : null}
      </div>
    </div>
  );
}
