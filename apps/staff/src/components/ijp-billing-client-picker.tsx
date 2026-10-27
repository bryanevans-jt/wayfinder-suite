"use client";

import { USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useId, useState } from "react";

type ClientOption = { id: string; name: string };

type Props = {
  value: string;
  onChange: (clientId: string) => void;
  disabled?: boolean;
  /** Shown above the search field */
  label?: string;
};

export function IjpBillingClientPicker({ value, onChange, disabled, label }: Props) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    const res = await fetch(`/api/ijp-billing/clients/search?q=${encodeURIComponent(q)}`);
    const data = (await res.json()) as { clients?: ClientOption[]; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
    }
    setOptions(data.clients ?? []);
    setLoadError(null);
  }, []);

  useEffect(() => {
    void load("").catch((e) =>
      setLoadError(e instanceof Error ? e.message : USER_FACING_SYSTEM_ERROR)
    );
  }, [load]);

  const selectedName =
    options.find((c) => c.id === value)?.name ?? selectedLabel ?? null;

  const listOptions =
    value && !options.some((c) => c.id === value) && selectedName
      ? [{ id: value, name: selectedName }, ...options]
      : options;

  return (
    <div className="min-w-[280px] flex-1 space-y-2">
      {label ? <span className="text-sm font-medium text-brand-black">{label}</span> : null}
      <input
        type="search"
        disabled={disabled}
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        placeholder="Search by name or email…"
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          void load(next).catch((err) =>
            setLoadError(err instanceof Error ? err.message : USER_FACING_SYSTEM_ERROR)
          );
        }}
        aria-controls={listId}
      />
      <select
        id={listId}
        disabled={disabled}
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        value={value}
        onChange={(e) => {
          const id = e.target.value;
          const name = listOptions.find((c) => c.id === id)?.name ?? null;
          setSelectedLabel(name);
          onChange(id);
        }}
      >
        <option value="">Select client…</option>
        {listOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {value && selectedName ? (
        <p className="text-xs text-brand-black/60">
          Selected: <span className="font-medium text-brand-black">{selectedName}</span>
        </p>
      ) : null}
      {loadError ? <p className="text-xs text-red-700">{loadError}</p> : null}
    </div>
  );
}
