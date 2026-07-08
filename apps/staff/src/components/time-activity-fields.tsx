"use client";

import type { ServiceActivityType } from "@wayfinder/supabase/es-time-tracking";
import {
  combineServiceDateAndTime,
  defaultActivityMinutes,
  groupActivityTypesByCategory,
  todayLocalDate,
} from "@wayfinder/supabase/es-time-tracking";
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
  startTime?: string;
  endTime?: string;
  onStartTimeChange?: (value: string) => void;
  onEndTimeChange?: (value: string) => void;
  activityTypeLabel?: string;
  disabled?: boolean;
};

function minutesBetweenTimes(serviceDate: string, startTime: string, endTime: string): number | null {
  const start = combineServiceDateAndTime(serviceDate, startTime);
  let end = combineServiceDateAndTime(serviceDate, endTime);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  const diff = Math.round((end.getTime() - start.getTime()) / (60 * 1000));
  return diff > 0 ? diff : null;
}

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
  startTime = "",
  endTime = "",
  onStartTimeChange,
  onEndTimeChange,
  activityTypeLabel = "Activity type",
  disabled = false,
}: Props) {
  const grouped = useMemo(() => groupActivityTypesByCategory(activities), [activities]);
  const selected = activities.find((a) => a.id === activityTypeId) ?? null;
  const effectiveServiceDate = serviceDate ?? todayLocalDate();
  const showTimeRange = Boolean(onStartTimeChange && onEndTimeChange);

  useEffect(() => {
    if (activityTypeId || activities.length === 0) {
      return;
    }
    const fallback =
      activities.find((a) => a.code === defaultCode) ?? activities[0] ?? null;
    if (fallback) {
      onActivityTypeIdChange(fallback.id);
      onDurationMinutesChange(defaultActivityMinutes(fallback));
    }
  }, [
    activities,
    activityTypeId,
    defaultCode,
    onActivityTypeIdChange,
    onDurationMinutesChange,
  ]);

  useEffect(() => {
    if (!showTimeRange || !startTime || !endTime) {
      return;
    }
    const nextMinutes = minutesBetweenTimes(effectiveServiceDate, startTime, endTime);
    if (nextMinutes && nextMinutes !== durationMinutes) {
      onDurationMinutesChange(nextMinutes);
    }
  }, [
    durationMinutes,
    effectiveServiceDate,
    endTime,
    onDurationMinutesChange,
    showTimeRange,
    startTime,
  ]);

  function onActivityChange(id: string) {
    onActivityTypeIdChange(id);
    const next = activities.find((a) => a.id === id);
    if (next) {
      onDurationMinutesChange(defaultActivityMinutes(next));
    }
    onStartTimeChange?.("");
    onEndTimeChange?.("");
  }

  return (
    <div className="rounded-lg border border-brand-green/20 bg-brand-green/5 p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
        Billable time
      </p>
      <label className="block text-sm font-medium text-brand-black">
        {activityTypeLabel}
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
              {defaultActivityMinutes(selected)})
            </span>
          ) : null}
        </label>
        {showServiceDate && onServiceDateChange ? (
          <label className="block text-sm font-medium text-brand-black">
            Service date
            <input
              type="date"
              value={effectiveServiceDate}
              onChange={(e) => onServiceDateChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
              disabled={disabled}
            />
          </label>
        ) : null}
      </div>
      {showTimeRange ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-brand-black">
            Start time <span className="font-normal text-brand-black/55">(optional)</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => onStartTimeChange?.(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
              disabled={disabled}
            />
          </label>
          <label className="block text-sm font-medium text-brand-black">
            End time <span className="font-normal text-brand-black/55">(optional)</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => onEndTimeChange?.(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
              disabled={disabled}
            />
          </label>
        </div>
      ) : null}
      {showTimeRange ? (
        <p className="text-xs text-brand-black/55">
          Leave start and end blank to use the time you submit this entry as the end time. Start time
          will be calculated from duration.
        </p>
      ) : null}
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
    durationMinutes: match ? defaultActivityMinutes(match) : 30,
  };
}
