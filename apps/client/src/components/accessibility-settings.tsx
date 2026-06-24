"use client";

import { useEffect, useState } from "react";

type Props = {
  initialLargeText: boolean;
  initialHighContrast: boolean;
};

export function AccessibilitySettings({ initialLargeText, initialHighContrast }: Props) {
  const [largeText, setLargeText] = useState(initialLargeText);
  const [highContrast, setHighContrast] = useState(initialHighContrast);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("wf-a11y-large-text", largeText);
    document.documentElement.classList.toggle("wf-a11y-high-contrast", highContrast);
  }, [largeText, highContrast]);

  async function persist(next: { largeText?: boolean; highContrast?: boolean }) {
    setSaving(true);
    try {
      await fetch("/api/accessibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessibility_large_text: next.largeText ?? largeText,
          accessibility_high_contrast: next.highContrast ?? highContrast,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Display & accessibility
      </h2>
      <p className="mt-1 text-xs text-brand-black/65">
        Adjust how Wayfinder looks on this device. Settings are saved to your account.
      </p>
      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={largeText}
            onChange={(e) => {
              setLargeText(e.target.checked);
              void persist({ largeText: e.target.checked });
            }}
          />
          Larger text
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={highContrast}
            onChange={(e) => {
              setHighContrast(e.target.checked);
              void persist({ highContrast: e.target.checked });
            }}
          />
          High contrast
        </label>
        {saving ? <p className="text-xs text-brand-black/50">Saving…</p> : null}
      </div>
    </section>
  );
}
