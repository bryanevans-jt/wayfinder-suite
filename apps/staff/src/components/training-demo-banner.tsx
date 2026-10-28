"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  targetName: string | null;
};

export function TrainingDemoBanner({ targetName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function exitDemo() {
    setBusy(true);
    await fetch("/api/training/es-demo/exit", { method: "POST" });
    setBusy(false);
    router.push("/dashboard/portal");
    router.refresh();
  }

  return (
    <div className="border-b border-brand-green/30 bg-brand-green/10 px-4 py-2 text-center text-sm text-brand-black">
      <span className="font-semibold">ES training demo</span>
      {targetName ? <> — viewing as {targetName}</> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void exitDemo()}
        className="ml-3 font-semibold text-brand-green underline disabled:opacity-50"
      >
        Exit demo
      </button>
    </div>
  );
}
