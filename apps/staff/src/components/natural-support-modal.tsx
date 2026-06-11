"use client";

import { NaturalSupportPanel } from "./natural-support-panel";

type Props = {
  open: boolean;
  clientId: string | null;
  clientLabel: string | null;
  onClose: () => void;
};

export function NaturalSupportModal({ open, clientId, clientLabel, onClose }: Props) {
  if (!open || !clientId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog backdrop"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="natural-support-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="natural-support-title" className="text-lg font-semibold text-brand-black">
            Natural Support
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-brand-black/60 hover:bg-neutral-100"
          >
            Close
          </button>
        </div>
        <NaturalSupportPanel clientId={clientId} clientLabel={clientLabel ?? undefined} compact />
      </div>
    </div>
  );
}
