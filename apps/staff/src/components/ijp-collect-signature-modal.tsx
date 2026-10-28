"use client";

import { IjpClientSignatureSection } from "@/components/ijp-client-signature-section";

type Props = {
  clientId: string;
  clientLabel: string;
  open: boolean;
  onClose: () => void;
};

export function IjpCollectSignatureModal({ clientId, clientLabel, open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ijp-collect-signature-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="ijp-collect-signature-title" className="text-lg font-semibold text-brand-black">
              Collect IJP signature
            </h2>
            <p className="text-sm text-brand-black/65">{clientLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-brand-black/60 hover:bg-neutral-100"
          >
            Close
          </button>
        </div>
        <div className="mt-4">
          <IjpClientSignatureSection clientId={clientId} />
        </div>
      </div>
    </div>
  );
}
