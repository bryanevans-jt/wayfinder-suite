import { PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";

export type WeeklyHour = {
  dayOfWeek: number; // 0=Sunday … 6=Saturday
  startTime: string; // "HH:MM" or "HH:MM:SS"
  endTime: string;
};

export type BusyRange = {
  start: Date;
  end: Date;
};

export type Slot = {
  start: Date;
  end: Date;
};

export type SlotCalcInput = {
  weeklyHours: WeeklyHour[];
  meetingLengthMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  bookingWindowDays: number;
  /** Instant “now” for notice calculations. */
  now: Date;
  /** Inclusive search window (UTC instants). */
  rangeStart: Date;
  rangeEnd: Date;
  busy: BusyRange[];
  /** Existing confirmed bookings treated like busy. */
  existingBookings?: BusyRange[];
  timeZone?: string;
};

function parseTimeParts(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":").map((p) => Number(p));
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    throw new Error(`Invalid time: ${value}`);
  }
  return { hour: h, minute: m };
}

/** Format a Date in a timezone as yyyy-mm-dd. */
export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function weekdayInTimeZone(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

/**
 * Build a UTC Date for a local civil date + time in `timeZone`.
 * Uses an iterative offset resolve (handles DST).
 */
export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? "0");
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second")
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    guess += desired - asUtc;
  }
  return new Date(guess);
}

function addCivilDays(year: number, month: number, day: number, delta: number) {
  const dt = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

function rangesOverlap(a: BusyRange, b: BusyRange): boolean {
  return a.start < b.end && b.start < a.end;
}

function isBlocked(slot: Slot, blocked: BusyRange[], bufferMs: number): boolean {
  const padded: BusyRange = {
    start: new Date(slot.start.getTime() - bufferMs),
    end: new Date(slot.end.getTime() + bufferMs),
  };
  return blocked.some((b) => rangesOverlap(padded, b));
}

/** Expand weekly hours into concrete open slots, minus busy + bookings. */
export function calculateOpenSlots(input: SlotCalcInput): Slot[] {
  const timeZone = input.timeZone ?? PORTAL_DISPLAY_TIME_ZONE;
  const lengthMs = input.meetingLengthMinutes * 60_000;
  const bufferMs = input.bufferMinutes * 60_000;
  const minStart = new Date(input.now.getTime() + input.minNoticeHours * 3_600_000);
  const maxEnd = new Date(
    Math.min(
      input.rangeEnd.getTime(),
      input.now.getTime() + input.bookingWindowDays * 86_400_000
    )
  );

  const blocked: BusyRange[] = [...input.busy, ...(input.existingBookings ?? [])];

  const hoursByDay = new Map<number, WeeklyHour[]>();
  for (const wh of input.weeklyHours) {
    const list = hoursByDay.get(wh.dayOfWeek) ?? [];
    list.push(wh);
    hoursByDay.set(wh.dayOfWeek, list);
  }

  const startKey = dateKeyInTimeZone(input.rangeStart, timeZone);
  const endKey = dateKeyInTimeZone(maxEnd, timeZone);
  let [y, m, d] = startKey.split("-").map(Number);
  const [ey, em, ed] = endKey.split("-").map(Number);
  const endOrdinal = Date.UTC(ey, em - 1, ed);

  const slots: Slot[] = [];

  while (Date.UTC(y, m - 1, d) <= endOrdinal) {
    const noon = zonedDateTimeToUtc(y, m, d, 12, 0, timeZone);
    const dow = weekdayInTimeZone(noon, timeZone);
    const windows = hoursByDay.get(dow) ?? [];

    for (const win of windows) {
      const startParts = parseTimeParts(win.startTime);
      const endParts = parseTimeParts(win.endTime);
      let slotStart = zonedDateTimeToUtc(
        y,
        m,
        d,
        startParts.hour,
        startParts.minute,
        timeZone
      );
      const windowEnd = zonedDateTimeToUtc(
        y,
        m,
        d,
        endParts.hour,
        endParts.minute,
        timeZone
      );

      while (slotStart.getTime() + lengthMs <= windowEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + lengthMs);
        const slot: Slot = { start: slotStart, end: slotEnd };
        if (
          slot.start >= minStart &&
          slot.end <= maxEnd &&
          slot.start >= input.rangeStart &&
          !isBlocked(slot, blocked, bufferMs)
        ) {
          slots.push(slot);
        }
        slotStart = new Date(slotStart.getTime() + lengthMs);
      }
    }

    ({ year: y, month: m, day: d } = addCivilDays(y, m, d, 1));
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** True when a proposed booking conflicts with busy or existing confirmed bookings. */
export function hasBookingConflict(opts: {
  start: Date;
  end: Date;
  bufferMinutes: number;
  busy: BusyRange[];
  existingBookings: BusyRange[];
}): boolean {
  const bufferMs = opts.bufferMinutes * 60_000;
  return isBlocked(
    { start: opts.start, end: opts.end },
    [...opts.busy, ...opts.existingBookings],
    bufferMs
  );
}

export function formatSlotEastern(slot: Slot): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PORTAL_DISPLAY_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(slot.start);
}
