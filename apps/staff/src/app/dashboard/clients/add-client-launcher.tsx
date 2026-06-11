"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AddClientModal,
  type CounselorOption,
  type OfficeOption,
  type ServiceOption,
} from "./add-client-modal";

type LauncherProps = {
  services: ServiceOption[];
  offices: OfficeOption[];
  counselors: CounselorOption[];
};

export function AddClientLauncher({ services, offices, counselors }: LauncherProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-gold/90"
      >
        Add client
      </button>
      <AddClientModal
        open={open}
        onClose={() => setOpen(false)}
        services={services}
        offices={offices}
        counselors={counselors}
        onCreated={() => router.refresh()}
      />
    </>
  );
}
