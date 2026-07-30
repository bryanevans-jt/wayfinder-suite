"use client";

export function ReferralDetailActions({ clientId }: { clientId: string }) {
  return (
    <a
      href={`/api/exports/referrals/pdf?clientId=${encodeURIComponent(clientId)}`}
      className="inline-flex rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-brand-green hover:bg-neutral-50"
    >
      Export Referral PDF
    </a>
  );
}
