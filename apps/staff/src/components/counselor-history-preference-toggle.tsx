"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = {
  initialShowHistory: boolean;
};

export function CounselorHistoryPreferenceToggle({ initialShowHistory }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await fetch("/api/counselor/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showPriorServiceHistory: !initialShowHistory }),
      });
      router.refresh();
    });
  }

  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-brand-black/85">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-green focus:ring-brand-green"
        checked={initialShowHistory}
        disabled={pending}
        onChange={toggle}
        aria-describedby="counselor-history-pref-hint"
      />
      <span>
        <span className="font-medium text-brand-black">Show prior service history</span>
        <span id="counselor-history-pref-hint" className="mt-0.5 block text-brand-black/65">
          When unchecked, only the current authorization&apos;s activity is shown. Your choice is
          remembered for future sessions.
        </span>
      </span>
    </label>
  );
}
