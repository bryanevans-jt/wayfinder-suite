"use client";

import { useEffect, useState } from "react";

type ToggleState = {
  community_partners_enabled: boolean;
  traditional_supported_employment_enabled: boolean;
  job_coaching_enabled: boolean;
  customized_supported_employment_enabled: boolean;
  groupme_celebrations_enabled: boolean;
  celebration_birthday_template: string;
  celebration_anniversary_template: string;
};

const EMPTY: ToggleState = {
  community_partners_enabled: false,
  traditional_supported_employment_enabled: false,
  job_coaching_enabled: false,
  customized_supported_employment_enabled: false,
  groupme_celebrations_enabled: true,
  celebration_birthday_template: "Happy Birthday, {first_name}! Hope you have a fantastic day!",
  celebration_anniversary_template:
    "Today {name} celebrates {years} years at Joshua Tree! Happy work anniversary, {first_name}!",
};

export function FeatureTogglesPanel() {
  const [form, setForm] = useState<ToggleState>(EMPTY);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/portal/feature-toggles");
        const data = (await res.json()) as Partial<ToggleState>;
        if (res.ok) {
          setForm({
            community_partners_enabled: data.community_partners_enabled === true,
            traditional_supported_employment_enabled:
              data.traditional_supported_employment_enabled === true,
            job_coaching_enabled: data.job_coaching_enabled === true,
            customized_supported_employment_enabled:
              data.customized_supported_employment_enabled === true,
            groupme_celebrations_enabled: data.groupme_celebrations_enabled !== false,
            celebration_birthday_template:
              data.celebration_birthday_template?.trim() || EMPTY.celebration_birthday_template,
            celebration_anniversary_template:
              data.celebration_anniversary_template?.trim() ||
              EMPTY.celebration_anniversary_template,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setStatus(null);
    const res = await fetch("/api/portal/feature-toggles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json()) as { error?: string };
    setStatus(res.ok ? "Saved." : data.error || "Save failed");
  }

  async function sendTest() {
    setTestStatus(null);
    const res = await fetch("/api/portal/groupme-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Joshua Tree Wayfinder test message — GroupMe bot is working." }),
    });
    const data = (await res.json()) as { error?: string; ok?: boolean };
    setTestStatus(res.ok ? "Test message sent." : data.error || "Test failed");
  }

  if (loading) {
    return <p className="text-sm text-brand-black/60">Loading Feature Toggles…</p>;
  }

  return (
    <section className="max-w-2xl space-y-6 rounded-xl border border-neutral-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Feature Toggles</h2>
        <p className="mt-1 text-sm text-brand-black/75">
          Control org-wide surfaces. Clients already on a hidden service keep that assignment until
          you change it. Website referral embeds may need republishing after changing referral
          services.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-brand-black">Services &amp; Network</h3>
        {(
          [
            ["community_partners_enabled", "Community Partners (nav and pages)"],
            [
              "traditional_supported_employment_enabled",
              "Traditional Supported Employment (new referrals / service pickers)",
            ],
            ["job_coaching_enabled", "Job Coaching (new referrals / service pickers)"],
            [
              "customized_supported_employment_enabled",
              "Customized Supported Employment (service pickers)",
            ],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-start gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="space-y-3 border-t border-neutral-100 pt-4">
        <h3 className="text-sm font-semibold text-brand-black">GroupMe Celebrations</h3>
        <label className="flex items-start gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.groupme_celebrations_enabled}
            onChange={(e) =>
              setForm((f) => ({ ...f, groupme_celebrations_enabled: e.target.checked }))
            }
          />
          <span>Send birthday and work anniversary messages to GroupMe (9:00 AM Eastern)</span>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Birthday Template</span>
          <textarea
            value={form.celebration_birthday_template}
            onChange={(e) =>
              setForm((f) => ({ ...f, celebration_birthday_template: e.target.value }))
            }
            rows={2}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-brand-black/55">
            Placeholders: {"{name}"}, {"{first_name}"} — never include age.
          </span>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Work Anniversary Template</span>
          <textarea
            value={form.celebration_anniversary_template}
            onChange={(e) =>
              setForm((f) => ({ ...f, celebration_anniversary_template: e.target.value }))
            }
            rows={2}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-brand-black/55">
            Placeholders: {"{name}"}, {"{first_name}"}, {"{years}"}. Sent only when tenure is at
            least 1 year.
          </span>
        </label>
        <button
          type="button"
          onClick={() => void sendTest()}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
        >
          Send GroupMe Test Message
        </button>
        {testStatus ? <p className="text-sm text-brand-black/70">{testStatus}</p> : null}
      </div>

      <button
        type="button"
        onClick={() => void save()}
        className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90"
      >
        Save Feature Toggles
      </button>
      {status ? <p className="text-sm text-brand-black/70">{status}</p> : null}
    </section>
  );
}
