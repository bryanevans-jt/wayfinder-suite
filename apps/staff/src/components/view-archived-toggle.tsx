"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  className?: string;
};

export function ViewArchivedToggle({ className }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showArchived = searchParams.get("archived") === "1";

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (showArchived) {
      params.delete("archived");
    } else {
      params.set("archived", "1");
    }
    const query = params.toString();
    router.push(query ? `?${query}` : "?");
  }

  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 text-sm text-brand-black/80 ${className ?? ""}`}
    >
      <input
        type="checkbox"
        checked={showArchived}
        onChange={toggle}
        className="size-4 rounded border-neutral-300 text-brand-green focus:ring-brand-green"
      />
      View archived
    </label>
  );
}
