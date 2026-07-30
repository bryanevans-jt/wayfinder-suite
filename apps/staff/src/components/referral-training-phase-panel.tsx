"use client";

import { useEffect, useState } from "react";

export function ReferralTrainingPhasePanel() {
  const [training, setTraining] = useState(true);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/portal/referral-settings");
        const data = (await res.json()) as {
          referral_training_phase?: boolean;
          referral_notify_email?: string | null;
        };
        if (res.ok) {
          setTraining(data.referral_training_phase !== false);
          setEmail(data.referral_notify_email ?? "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setStatus(null);
    const res = await fetch("/api/portal/referral-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referral_training_phase: training,
        referral_notify_email: email.trim() || null,
      }),
    });
    const data = (await res.json()) as { error?: string };
    setStatus(res.ok ? "Saved." : data.error || "Save failed");
  }

  if (loading) {
    return <p className="text-sm text-brand-black/60">Loading referral settings…</p>;
  }

  return (
    <section className="max-w-xl space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-black">Referral training phase</h2>
      <p className="text-sm text-brand-black/75">
        When on, HR intake notifications (new referral, SLA reminders) also go to admins. When off,
        only the HR Director role receives them. Counselor confirmation emails are unchanged.
      </p>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={training}
          onChange={(e) => setTraining(e.target.checked)}
        />
        Training phase on (admins get HR intake notifications)
      </label>
      <label className="block text-sm">
        <span className="font-medium">Referral notify email (HR inbox)</span>
        <input
          className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ryan.herrington@thejoshuatree.org"
        />
      </label>
      <button
        type="button"
        onClick={() => void save()}
        className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90"
      >
        Save
      </button>
      {status ? <p className="text-sm text-brand-black/70">{status}</p> : null}
    </section>
  );
}
