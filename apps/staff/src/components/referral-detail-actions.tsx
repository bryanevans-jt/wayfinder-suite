"use client";

import { useState } from "react";

export function ReferralDetailActions({ clientId }: { clientId: string }) {
  const [resendState, setResendState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function resendCounselorConfirmation() {
    setResendState("loading");
    setResendMessage(null);
    try {
      const res = await fetch("/api/referrals/counselor-confirmation/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setResendState("error");
        setResendMessage(data.error ?? "Could not send confirmation email.");
        return;
      }
      setResendState("ok");
      setResendMessage("Counselor confirmation email sent.");
    } catch {
      setResendState("error");
      setResendMessage("Could not send confirmation email.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={`/api/exports/referrals/pdf?clientId=${encodeURIComponent(clientId)}`}
        className="inline-flex rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-brand-green hover:bg-neutral-50"
      >
        Export Referral PDF
      </a>
      <button
        type="button"
        onClick={() => void resendCounselorConfirmation()}
        disabled={resendState === "loading"}
        className="inline-flex rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-brand-black hover:bg-neutral-50 disabled:opacity-60"
      >
        {resendState === "loading" ? "Sending…" : "Resend counselor confirmation"}
      </button>
      {resendMessage ? (
        <span
          className={`text-sm ${resendState === "error" ? "text-red-700" : "text-brand-black/70"}`}
        >
          {resendMessage}
        </span>
      ) : null}
    </div>
  );
}
