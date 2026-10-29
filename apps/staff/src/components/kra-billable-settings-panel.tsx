"use client";

import {
  DEFAULT_KRA_HOURS_PER_CLIENT,
  KRA_GVRA_SERVICE_NAMES,
  type KraBillableRule,
} from "@wayfinder/supabase/kra-billable-settings";
import { useEffect, useState } from "react";

type ServiceRow = { id: string; name: string; state: string | null };

type Settings = {
  count_system_allowance_toward_kra: boolean;
  successor_inherits_client_month_hours: boolean;
  rules: KraBillableRule[];
};

export function KraBillableSettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/kra-billable-settings");
      const data = (await res.json()) as {
        settings?: Settings;
        services?: ServiceRow[];
      };
      if (res.ok && data.settings) {
        setSettings({
          count_system_allowance_toward_kra: data.settings.count_system_allowance_toward_kra !== false,
          successor_inherits_client_month_hours:
            data.settings.successor_inherits_client_month_hours !== false,
          rules: data.settings.rules?.length
            ? data.settings.rules
            : [{ service_ids: [], hours_per_client_per_month: DEFAULT_KRA_HOURS_PER_CLIENT }],
        });
        setServices(data.services ?? []);
      }
    })();
  }, []);

  function updateRule(index: number, patch: Partial<KraBillableRule>) {
    if (!settings) return;
    const rules = settings.rules.map((r, i) => (i === index ? { ...r, ...patch } : r));
    setSettings({ ...settings, rules });
  }

  function toggleService(ruleIndex: number, serviceId: string) {
    if (!settings) return;
    const rule = settings.rules[ruleIndex];
    const set = new Set(rule.service_ids);
    if (set.has(serviceId)) set.delete(serviceId);
    else set.add(serviceId);
    updateRule(ruleIndex, { service_ids: [...set] });
  }

  function addRule() {
    if (!settings) return;
    setSettings({
      ...settings,
      rules: [
        ...settings.rules,
        { service_ids: [], hours_per_client_per_month: DEFAULT_KRA_HOURS_PER_CLIENT },
      ],
    });
  }

  function removeRule(index: number) {
    if (!settings || settings.rules.length <= 1) return;
    setSettings({
      ...settings,
      rules: settings.rules.filter((_, i) => i !== index),
    });
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/kra-billable-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setMessage(res.ok ? "KRA billable settings saved." : "Could not save settings.");
  }

  if (!settings) return null;

  const highlighted = new Set<string>([...KRA_GVRA_SERVICE_NAMES]);

  return (
    <section className="mt-10 max-w-3xl rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-black">KRA billable hours per client</h2>
      <p className="mt-1 text-sm text-brand-black/65">
        Minimum billable hours per client per calendar month for ES/TS KRAs. Shown on Billable Hours
        for Admins. IJP and Traditional Supported Employment default to 10 hours.
      </p>

      <div className="mt-4 space-y-3 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={settings.count_system_allowance_toward_kra}
            onChange={(e) =>
              setSettings({ ...settings, count_system_allowance_toward_kra: e.target.checked })
            }
          />
          <span>Count GVRA 2 hr/month system allowance toward KRA totals</span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={settings.successor_inherits_client_month_hours}
            onChange={(e) =>
              setSettings({
                ...settings,
                successor_inherits_client_month_hours: e.target.checked,
              })
            }
          />
          <span>
            KRA uses full client-month billable pool for each assignee (handoff fairness; payroll
            unchanged)
          </span>
        </label>
      </div>

      <div className="mt-6 space-y-6">
        {settings.rules.map((rule, ruleIndex) => (
          <div key={ruleIndex} className="rounded-lg border border-neutral-200 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="block text-sm">
                <span className="font-medium">Required hours per client / month</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className="mt-1 block w-32 rounded-lg border border-neutral-300 px-3 py-2"
                  value={rule.hours_per_client_per_month}
                  onChange={(e) =>
                    updateRule(ruleIndex, {
                      hours_per_client_per_month: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              {settings.rules.length > 1 ? (
                <button
                  type="button"
                  className="text-sm text-red-700 hover:underline"
                  onClick={() => removeRule(ruleIndex)}
                >
                  Remove rule
                </button>
              ) : null}
            </div>
            <p className="mt-3 text-xs font-medium text-brand-black/60">Services in this rule</p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
              {services.map((s) => (
                <li key={s.id}>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rule.service_ids.includes(s.id)}
                      onChange={() => toggleService(ruleIndex, s.id)}
                    />
                    <span className={highlighted.has(s.name) ? "font-medium" : undefined}>
                      {s.name}
                      {s.state ? ` (${s.state})` : ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="mt-4 text-sm font-medium text-brand-green hover:underline"
        onClick={addRule}
      >
        Add another threshold rule
      </button>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {message ? <span className="text-sm text-brand-black/70">{message}</span> : null}
      </div>
    </section>
  );
}
