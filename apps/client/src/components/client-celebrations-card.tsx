"use client";

import { formatPortalDateTime } from "@wayfinder/branding";
import { useCallback, useEffect, useState } from "react";
import { CLIENT_DASHBOARD_SECTION_IDS as IDS } from "@/lib/dashboard-section-ids";
import { CLIENT_DASHBOARD_SECTIONS as LABELS } from "@/lib/dashboard-section-labels";

type Row = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  created_at: string;
};

export function ClientCelebrationsCard() {
  const [items, setItems] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    const data = (await res.json()) as { notifications?: Row[] };
    if (res.ok) {
      setItems(
        (data.notifications ?? []).filter((n) => n.kind === "employment_celebration").slice(0, 3)
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (items.length === 0) return null;

  return (
    <section
      id={IDS.celebrating}
      aria-labelledby={IDS.celebratingHeading}
      className="rounded-xl border border-brand-gold/40 bg-brand-gold/10 p-4"
      aria-live="polite"
    >
      <h2 id={IDS.celebratingHeading} className="text-sm font-semibold text-brand-black/70">
        {LABELS.celebrating}
      </h2>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="text-sm">
            <p className="font-semibold text-brand-black">{item.title}</p>
            {item.body ? <p className="mt-1 text-brand-black/80">{item.body}</p> : null}
            <p className="mt-1 text-xs text-brand-black/50">{formatPortalDateTime(item.created_at)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
