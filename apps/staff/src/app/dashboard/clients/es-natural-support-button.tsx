"use client";

import { NaturalSupportModal } from "@/components/natural-support-modal";
import { useState } from "react";

type Props = {
  clientId: string;
  clientLabel: string;
};

export function EsNaturalSupportButton({ clientId, clientLabel }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="font-medium text-brand-green hover:underline"
        onClick={() => setOpen(true)}
      >
        Invite
      </button>
      <NaturalSupportModal
        open={open}
        clientId={clientId}
        clientLabel={clientLabel}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
