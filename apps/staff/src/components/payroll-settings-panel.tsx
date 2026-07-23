"use client";

import { useEffect, useState } from "react";

type Settings = {
  pay_period_frequency: "weekly" | "biweekly" | "monthly";
  period_start_date: string;
  period_end_date: string | null;
};

export function PayrollSettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/payroll-settings");
      const data = (await res.json()) as { settings?: Settings };
      if (res.ok && data.settings) setSettings(data.settings);
    })();
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/payroll-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setMessage(res.ok ? "Payroll settings saved." : "Could not save settings.");
  }

  if (!settings) return null;

  return (
    <section className="mt-10 max-w-xl rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-black">Payroll export settings</h2>
      <p className="mt-1 text-sm text-brand-black/65">
        Configure pay period frequency and anchor dates for Accounts Specialist and HR payroll /
        billable CSV pulls.
      </p>
      <div className="mt-4 space-y-3 text-sm">
        <label className="block">
          <span className="font-medium">Frequency</span>
          <select
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={settings.pay_period_frequency}
            onChange={(e) =>
              setSettings({
                ...settings,
                pay_period_frequency: e.target.value as Settings["pay_period_frequency"],
              })
            }
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label className="block">
          <span className="font-medium">Period start date</span>
          <input
            type="date"
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={settings.period_start_date}
            onChange={(e) => setSettings({ ...settings, period_start_date: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="font-medium">Period end date (optional, monthly)</span>
          <input
            type="date"
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={settings.period_end_date ?? ""}
            onChange={(e) =>
              setSettings({ ...settings, period_end_date: e.target.value || null })
            }
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white"
        >
          {saving ? "Saving…" : "Save payroll settings"}
        </button>
        {message ? <p className="text-sm text-brand-black/70">{message}</p> : null}
        <p className="text-xs text-brand-black/55">
          Accounts Specialist and HR download hours worked at{" "}
          <code className="rounded bg-neutral-100 px-1">/api/exports/payroll</code> and billable by
          client at <code className="rounded bg-neutral-100 px-1">/api/exports/billable</code>.
        </p>
      </div>
    </section>
  );
}
