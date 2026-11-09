"use client";

import { useState } from "react";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
];

type WeeklyHour = { dayOfWeek: number; startTime: string; endTime: string };

type Props = {
  staffOptions: { id: string; label: string }[];
  initial?: {
    id?: string;
    staffUserId?: string;
    slug?: string;
    displayName?: string;
    enabled?: boolean;
    meetingLengthMinutes?: number;
    bufferMinutes?: number;
    minNoticeHours?: number;
    bookingWindowDays?: number;
    defaultLocation?: string;
    weeklyHours?: WeeklyHour[];
  };
};

export function AdminScheduleForm({ staffOptions, initial }: Props) {
  const [staffUserId, setStaffUserId] = useState(initial?.staffUserId ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [meetingLengthMinutes, setMeetingLengthMinutes] = useState(
    initial?.meetingLengthMinutes ?? 60
  );
  const [bufferMinutes, setBufferMinutes] = useState(initial?.bufferMinutes ?? 0);
  const [minNoticeHours, setMinNoticeHours] = useState(initial?.minNoticeHours ?? 24);
  const [bookingWindowDays, setBookingWindowDays] = useState(
    initial?.bookingWindowDays ?? 14
  );
  const [defaultLocation, setDefaultLocation] = useState(initial?.defaultLocation ?? "");
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHour[]>(
    initial?.weeklyHours?.length
      ? initial.weeklyHours
      : DAYS.map((d) => ({ dayOfWeek: d.value, startTime: "09:00", endTime: "16:00" }))
  );
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleDay(dayOfWeek: number) {
    setWeeklyHours((prev) => {
      const exists = prev.some((h) => h.dayOfWeek === dayOfWeek);
      if (exists) return prev.filter((h) => h.dayOfWeek !== dayOfWeek);
      return [...prev, { dayOfWeek, startTime: "09:00", endTime: "16:00" }];
    });
  }

  function updateDay(dayOfWeek: number, patch: Partial<WeeklyHour>) {
    setWeeklyHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h))
    );
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    const payload = {
      id: initial?.id,
      staffUserId,
      slug,
      displayName,
      enabled,
      meetingLengthMinutes,
      bufferMinutes,
      minNoticeHours,
      bookingWindowDays,
      defaultLocation,
      weeklyHours,
    };
    const res = await fetch("/api/admin/schedules", {
      method: initial?.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { error?: string; ok?: boolean };
    setSaving(false);
    setStatus(res.ok ? "Saved." : data.error || "Save failed");
  }

  return (
    <div className="space-y-5 rounded-2xl border border-brand-green/15 bg-white/90 p-5 shadow-sm">
      <div>
        <label className="block text-sm font-semibold">Staff member</label>
        <select
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          value={staffUserId}
          onChange={(e) => setStaffUserId(e.target.value)}
          disabled={Boolean(initial?.id)}
        >
          <option value="">Select…</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold">Display name</label>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold">Booking page link name</label>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="jane-doe"
          />
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-5 w-5"
        />
        Booking page is ON (counselors can book)
      </label>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField label="Meeting length (minutes)" value={meetingLengthMinutes} onChange={setMeetingLengthMinutes} />
        <NumberField label="Buffer (minutes)" value={bufferMinutes} onChange={setBufferMinutes} />
        <NumberField label="Minimum notice (hours)" value={minNoticeHours} onChange={setMinNoticeHours} />
        <NumberField label="Booking window (days)" value={bookingWindowDays} onChange={setBookingWindowDays} />
      </div>

      <div>
        <label className="block text-sm font-semibold">Default in-person location</label>
        <input
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          value={defaultLocation}
          onChange={(e) => setDefaultLocation(e.target.value)}
          placeholder="Office address or meeting place"
        />
      </div>

      <div>
        <p className="text-sm font-semibold">Weekly hours (Eastern Time)</p>
        <div className="mt-2 space-y-2">
          {DAYS.map((day) => {
            const active = weeklyHours.find((h) => h.dayOfWeek === day.value);
            return (
              <div key={day.value} className="flex flex-wrap items-center gap-3">
                <label className="flex w-28 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(active)}
                    onChange={() => toggleDay(day.value)}
                  />
                  {day.label}
                </label>
                {active ? (
                  <>
                    <input
                      type="time"
                      className="rounded border border-neutral-300 px-2 py-1"
                      value={active.startTime}
                      onChange={(e) => updateDay(day.value, { startTime: e.target.value })}
                    />
                    <span className="text-sm text-neutral-500">to</span>
                    <input
                      type="time"
                      className="rounded border border-neutral-300 px-2 py-1"
                      value={active.endTime}
                      onChange={(e) => updateDay(day.value, { endTime: e.target.value })}
                    />
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <button type="button" className="rv-btn-primary" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save schedule"}
      </button>
      {status ? <p className="text-sm text-brand-black/70">{status}</p> : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold">{label}</label>
      <input
        type="number"
        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
