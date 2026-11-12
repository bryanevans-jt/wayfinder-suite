"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_BOOKING_WINDOW_DAYS,
  DEFAULT_BUFFER_MINUTES,
  DEFAULT_MEETING_LENGTH_MINUTES,
  DEFAULT_MIN_NOTICE_HOURS,
  DEFAULT_WEEKLY_END,
  DEFAULT_WEEKLY_HOURS,
  DEFAULT_WEEKLY_START,
  slugFromPersonName,
} from "@/lib/scheduling/schedule-defaults";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
];

type WeeklyHour = { dayOfWeek: number; startTime: string; endTime: string };

type StaffOption = {
  id: string;
  label: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
};

type Props = {
  staffOptions: StaffOption[];
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
    initial?.meetingLengthMinutes ?? DEFAULT_MEETING_LENGTH_MINUTES
  );
  const [bufferMinutes, setBufferMinutes] = useState(
    initial?.bufferMinutes ?? DEFAULT_BUFFER_MINUTES
  );
  const [minNoticeHours, setMinNoticeHours] = useState(
    initial?.minNoticeHours ?? DEFAULT_MIN_NOTICE_HOURS
  );
  const [bookingWindowDays, setBookingWindowDays] = useState(
    initial?.bookingWindowDays ?? DEFAULT_BOOKING_WINDOW_DAYS
  );
  const [defaultLocation, setDefaultLocation] = useState(initial?.defaultLocation ?? "");
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHour[]>(
    initial?.weeklyHours?.length
      ? initial.weeklyHours
      : DEFAULT_WEEKLY_HOURS.map((h) => ({ ...h }))
  );
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [displayNameTouched, setDisplayNameTouched] = useState(Boolean(initial?.displayName));

  const optionsById = useMemo(
    () => new Map(staffOptions.map((s) => [s.id, s])),
    [staffOptions]
  );

  function selectTeamMember(id: string) {
    setStaffUserId(id);
    const selected = optionsById.get(id);
    if (!selected) return;

    if (!displayNameTouched) {
      const composed = [selected.firstName, selected.lastName]
        .map((p) => (p ?? "").trim())
        .filter(Boolean)
        .join(" ");
      setDisplayName(composed || selected.fullName || selected.label);
    }
    if (!slugTouched) {
      setSlug(
        slugFromPersonName({
          firstName: selected.firstName,
          lastName: selected.lastName,
          fullName: selected.fullName || selected.label,
        })
      );
    }
  }

  function toggleDay(dayOfWeek: number) {
    setWeeklyHours((prev) => {
      const exists = prev.some((h) => h.dayOfWeek === dayOfWeek);
      if (exists) return prev.filter((h) => h.dayOfWeek !== dayOfWeek);
      return [
        ...prev,
        { dayOfWeek, startTime: DEFAULT_WEEKLY_START, endTime: DEFAULT_WEEKLY_END },
      ];
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
    if (res.ok && !initial?.id) {
      window.location.reload();
    }
  }

  return (
    <div className="rv-panel space-y-5 rounded-3xl p-5 sm:p-6">
      <div>
        <label className="block text-sm font-semibold">Team Member</label>
        <select
          className="rv-input"
          value={staffUserId}
          onChange={(e) => selectTeamMember(e.target.value)}
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
          <label className="block text-sm font-semibold">Display Name</label>
          <input
            className="rv-input"
            value={displayName}
            onChange={(e) => {
              setDisplayNameTouched(true);
              setDisplayName(e.target.value);
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold">Booking Page Link Name</label>
          <input
            className="rv-input"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
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
        Booking Page Is On (Counselors Can Book)
      </label>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField
          label="Meeting Length (Minutes)"
          value={meetingLengthMinutes}
          onChange={setMeetingLengthMinutes}
        />
        <NumberField label="Buffer (Minutes)" value={bufferMinutes} onChange={setBufferMinutes} />
        <NumberField
          label="Minimum Notice (Hours)"
          value={minNoticeHours}
          onChange={setMinNoticeHours}
        />
        <NumberField
          label="Booking Window (Days)"
          value={bookingWindowDays}
          onChange={setBookingWindowDays}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold">Default In-Person Location</label>
        <input
          className="rv-input"
          value={defaultLocation}
          onChange={(e) => setDefaultLocation(e.target.value)}
          placeholder="Office address or meeting place"
        />
      </div>

      <div>
        <p className="text-sm font-semibold">Weekly Hours (Eastern Time)</p>
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
        {saving ? "Saving…" : "Save Schedule"}
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
        className="rv-input"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
