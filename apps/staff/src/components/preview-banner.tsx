"use client";

import { viewAsBannerCopy } from "@wayfinder/supabase/preview-policy";
import { personDisplayName } from "@wayfinder/branding";
import { useState } from "react";

type Props = {
  targetName: string | null;
  targetRole: string;
  staffAppUrl: string;
  demoClientsOnly?: boolean;
};

export function PreviewBanner({
  targetName,
  targetRole,
  staffAppUrl,
  demoClientsOnly = false,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function exitPreview() {
    setBusy(true);
    try {
      const res = await fetch(`${staffAppUrl}/api/preview/stop`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { redirectUrl?: string; error?: string };
      if (!res.ok) {
        window.location.href = `${staffAppUrl}/api/preview/stop`;
        return;
      }
      window.location.href = data.redirectUrl ?? `${staffAppUrl}/dashboard/audit`;
    } catch {
      window.location.href = `${staffAppUrl}/api/preview/stop`;
    }
  }

  const label = personDisplayName({ full_name: targetName, id: "" }, "User");
  const message = viewAsBannerCopy({
    targetName: label,
    targetRole,
    demoClientsOnly,
  });

  return (
    <div className="sticky top-0 z-50 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-brand-black">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-semibold">{message}</span>
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void exitPreview()}
          className="rounded-lg border border-amber-400 bg-white px-3 py-1 text-sm font-medium hover:bg-amber-100 disabled:opacity-60"
        >
          {busy ? "Exiting…" : "Exit View as"}
        </button>
      </div>
    </div>
  );
}
