"use client";

import { useEffect, useState } from "react";

type Settings = {
  period_start_date: string;
  annual_pto_days: number | null;
};

export function PtoSettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [annualInput, setAnnualInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/staff-pto/settings");
      const data = (await res.json()) as { settings?: Settings };
      if (res.ok && data.settings) {
        setSettings(data.settings);
        setAnnualInput(
          data.settings.annual_pto_days == null ? "" : String(data.settings.annual_pto_days)
        );
      }
    })();
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    const trimmed = annualInput.trim();
    const annual =
      trimmed === "" ? null : Number(trimmed);
    if (trimmed !== "" && (!Number.isFinite(annual) || (annual as number) < 0)) {
      setMessage("Annual PTO days must be blank (unlimited) or a non-negative number.");
      setSaving(false);
      return;
    }
    const res = await fetch("/api/staff-pto/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_start_date: settings.period_start_date,
        annual_pto_days: annual,
      }),
    });
    const data = (await res.json()) as { settings?: Settings; error?: string };
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error ?? "Could not save PTO settings.");
      return;
    }
    if (data.settings) {
      setSettings(data.settings);
      setAnnualInput(
        data.settings.annual_pto_days == null ? "" : String(data.settings.annual_pto_days)
      );
    }
    setMessage("PTO settings saved.");
  }

  if (!settings) return null;

  return (
    <section className="mt-10 max-w-xl rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-black">PTO Settings</h2>
      <p className="mt-1 text-sm text-brand-black/65">
        Org-wide allowance and period start (usually January 1). Leave annual days blank for
        unlimited.
      </p>
      <div className="mt-4 space-y-3 text-sm">
        <label className="block">
          <span className="font-medium">Period Start Date</span>
          <input
            type="date"
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={settings.period_start_date}
            onChange={(e) =>
              setSettings({ ...settings, period_start_date: e.target.value })
            }
          />
        </label>
        <label className="block">
          <span className="font-medium">Annual PTO Days (Blank = Unlimited)</span>
          <input
            type="number"
            min={0}
            step={0.5}
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={annualInput}
            onChange={(e) => setAnnualInput(e.target.value)}
            placeholder="Unlimited"
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save PTO Settings"}
        </button>
        {message ? <p className="text-sm text-brand-black/70">{message}</p> : null}
      </div>
    </section>
  );
}
