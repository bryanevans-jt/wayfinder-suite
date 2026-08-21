"use client";

import { useEffect, useState } from "react";

export function ServiceOfferingsPanel() {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/portal/service-offerings");
        const data = (await res.json()) as {
          customized_supported_employment_enabled?: boolean;
        };
        if (res.ok) {
          setEnabled(data.customized_supported_employment_enabled === true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setStatus(null);
    const res = await fetch("/api/portal/service-offerings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customized_supported_employment_enabled: enabled,
      }),
    });
    const data = (await res.json()) as { error?: string };
    setStatus(res.ok ? "Saved." : data.error || "Save failed");
  }

  if (loading) {
    return <p className="text-sm text-brand-black/60">Loading service offerings…</p>;
  }

  return (
    <section className="max-w-xl space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-black">Service Offerings</h2>
      <p className="text-sm text-brand-black/75">
        Control which services appear in Add Client and Edit Client lists. Clients already on a
        hidden service keep that assignment until you change it.
      </p>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Offer Customized Supported Employment
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
