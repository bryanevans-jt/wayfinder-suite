"use client";

import type { ServiceActivityType } from "@wayfinder/supabase/es-time-tracking";
import { groupActivityTypesByCategory, todayLocalDate } from "@wayfinder/supabase/es-time-tracking";
import { useEffect, useMemo } from "react";

type Props = {
  activities: ServiceActivityType[];
  defaultCode: string;
  activityTypeId: string;
  onActivityTypeIdChange: (id: string) => void;
  durationMinutes: number;
  onDurationMinutesChange: (minutes: number) => void;
  serviceDate?: string;
  onServiceDateChange?: (date: string) => void;
  showServiceDate?: boolean;
  disabled?: boolean;
};

export function TimeActivityFields({
  activities,
  defaultCode,
  activityTypeId,
  onActivityTypeIdChange,
  durationMinutes,
  onDurationMinutesChange,
  serviceDate,
  onServiceDateChange,
  showServiceDate = false,
  disabled = false,
}: Props) {
  const grouped = useMemo(() => groupActivityTypesByCategory(activities), [activities]);
  const selected = activities.find((a) => a.id === activityTypeId) ?? null;

  useEffect(() => {
    if (activityTypeId || activities.length === 0) {
      return;
    }
    const fallback =
      activities.find((a) => a.code === defaultCode) ?? activities[0] ?? null;
    if (fallback) {
      onActivityTypeIdChange(fallback.id);
      onDurationMinutesChange(fallback.default_minutes);
    }
  }, [
    activities,
    activityTypeId,
    defaultCode,
    onActivityTypeIdChange,
    onDurationMinutesChange,
  ]);

  function onActivityChange(id: string) {
    onActivityTypeIdChange(id);
    const next = activities.find((a) => a.id === id);
    if (next) {
      onDurationMinutesChange(next.default_minutes);
    }
  }

  return (
    <div className="rounded-lg border border-brand-green/20 bg-brand-green/5 p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
        Billable time
      </p>
      <label className="block text-sm font-medium text-brand-black">
        Activity type
        <select
          value={activityTypeId}
          onChange={(e) => onActivityChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
          disabled={disabled}
        >
          <option value="">Select activity…</option>
          {[...grouped.entries()].map(([category, items]) => (
            <optgroup key={category} label={category}>
              {items.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-brand-black">
          Duration (minutes)
          <input
            type="number"
            min={selected?.min_minutes ?? 5}
            max={selected?.max_minutes ?? 240}
            value={durationMinutes}
            onChange={(e) => onDurationMinutesChange(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
            disabled={disabled}
          />
          {selected ? (
            <span className="mt-1 block text-xs text-brand-black/55">
              Allowed: {selected.min_minutes}–{selected.max_minutes} min (default{" "}
              {selected.default_minutes})
            </span>
          ) : null}
        </label>
        {showServiceDate && onServiceDateChange ? (
          <label className="block text-sm font-medium text-brand-black">
            Service date
            <input
              type="date"
              value={serviceDate ?? todayLocalDate()}
              onChange={(e) => onServiceDateChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
              disabled={disabled}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}

export function useTimeActivityDefaults(
  activities: ServiceActivityType[],
  defaultCode: string
): { activityTypeId: string; durationMinutes: number } {
  const match = activities.find((a) => a.code === defaultCode) ?? activities[0];
  return {
    activityTypeId: match?.id ?? "",
    durationMinutes: match?.default_minutes ?? 30,
  };
}
