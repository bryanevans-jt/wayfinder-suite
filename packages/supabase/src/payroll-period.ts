export type PayPeriodFrequency = "weekly" | "biweekly" | "monthly";

export type PayPeriodRange = {
  start: string;
  end: string;
  frequency: PayPeriodFrequency;
};

export type PayrollSettingsRow = {
  pay_period_frequency: PayPeriodFrequency;
  period_start_date: string;
  period_end_date: string | null;
};

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDateOnly(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

/** Current pay period containing `asOf` based on org payroll settings. */
export function resolvePayPeriod(
  settings: PayrollSettingsRow,
  asOf = new Date()
): PayPeriodRange {
  const freq = settings.pay_period_frequency;
  const anchor = parseDateOnly(settings.period_start_date);
  const asOfDate = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate(), 12)
  );

  if (freq === "weekly") {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const diffWeeks = Math.floor((asOfDate.getTime() - anchor.getTime()) / msPerWeek);
    const start = new Date(anchor);
    start.setUTCDate(start.getUTCDate() + diffWeeks * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return { start: toDateOnly(start), end: toDateOnly(end), frequency: freq };
  }

  if (freq === "biweekly") {
    const msPerPeriod = 14 * 24 * 60 * 60 * 1000;
    const diff = Math.floor((asOfDate.getTime() - anchor.getTime()) / msPerPeriod);
    const start = new Date(anchor);
    start.setUTCDate(start.getUTCDate() + diff * 14);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 13);
    return { start: toDateOnly(start), end: toDateOnly(end), frequency: freq };
  }

  const start = new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), 1, 12));
  const end = new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth() + 1, 0, 12));
  if (settings.period_end_date) {
    const customEnd = parseDateOnly(settings.period_end_date);
    if (customEnd.getUTCMonth() === start.getUTCMonth()) {
      return {
        start: toDateOnly(start),
        end: settings.period_end_date,
        frequency: freq,
      };
    }
  }
  return { start: toDateOnly(start), end: toDateOnly(end), frequency: freq };
}

export function shiftPayPeriod(
  settings: PayrollSettingsRow,
  direction: -1 | 1,
  current: PayPeriodRange
): PayPeriodRange {
  const start = parseDateOnly(current.start);
  if (settings.pay_period_frequency === "weekly") {
    start.setUTCDate(start.getUTCDate() + direction * 7);
  } else if (settings.pay_period_frequency === "biweekly") {
    start.setUTCDate(start.getUTCDate() + direction * 14);
  } else {
    start.setUTCMonth(start.getUTCMonth() + direction);
  }
  return resolvePayPeriod(settings, start);
}
