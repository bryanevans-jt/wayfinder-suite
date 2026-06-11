"use client";

import { roleDisplayName } from "@wayfinder/supabase/roles";
import { personDisplayName } from "@wayfinder/branding";
import { useState } from "react";

type Props = {
  targetName: string | null;
  targetRole: string;
  staffAppUrl: string;
};

export function PreviewBanner({ targetName, targetRole, staffAppUrl }: Props) {
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
      window.location.href = data.redirectUrl ?? `${staffAppUrl}/dashboard/super-admin`;
    } catch {
      window.location.href = `${staffAppUrl}/api/preview/stop`;
    }
  }

  const label = personDisplayName({ full_name: targetName, id: "" }, "User");

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-brand-black">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-semibold">Previewing:</span> {label}{" "}
          <span className="text-brand-black/70">({roleDisplayName(targetRole)})</span>
          <span className="ml-2 text-brand-black/60">· Read-only</span>
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void exitPreview()}
          className="rounded-lg border border-amber-400 bg-white px-3 py-1 text-sm font-medium hover:bg-amber-100 disabled:opacity-60"
        >
          {busy ? "Exiting…" : "Exit preview"}
        </button>
      </div>
    </div>
  );
}
