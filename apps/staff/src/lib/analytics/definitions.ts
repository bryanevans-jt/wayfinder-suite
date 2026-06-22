/**
 * Canonical Wayfinder analytics definitions (v1).
 * All dashboard and export numbers derive from these rules.
 */

/** Metric catalog shown in the UI. */
export const ANALYTICS_METRIC_DEFINITIONS = {
  intakeDate: {
    label: "Intake date",
    description:
      "Earliest Phase 1 / Intake milestone event; if none, first accepted meeting; otherwise client enrollment date.",
  },
  hireDate: {
    label: "Hire date",
    description: "Date of the client's first application marked Hired.",
  },
  clientsHired: {
    label: "Clients hired",
    description: "Distinct clients whose first hire date falls in the selected date range.",
  },
  hireRate: {
    label: "Hire rate",
    description:
      "Clients hired in the period ÷ active assigned caseload (clients not in Closed or Dismissed stage).",
  },
  medianDaysToHire: {
    label: "Median days intake → hire",
    description:
      "Median calendar days from intake date to first hire, for clients hired in the selected period.",
  },
  activeCaseload: {
    label: "Active caseload",
    description:
      "Assigned clients in scope whose current stage is not Closed or Dismissed.",
  },
  applicationsSubmitted: {
    label: "Applications submitted",
    description: "Job applications created in the selected date range.",
  },
} as const;

export const CLOSED_STAGE_PATTERN = /^(closed(\s+successfully)?|dismissed)$/i;

export const INTAKE_STAGE_PATTERN = /intake|phase\s*1/i;

export function isHiredApplicationStatus(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === "hired";
}

export function defaultAnalyticsRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 11);
  from.setDate(1);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function parseDateRange(fromParam: string | null, toParam: string | null): {
  from: Date;
  to: Date;
  fromIso: string;
  toIso: string;
} {
  const defaults = defaultAnalyticsRange();
  const from = fromParam ? new Date(`${fromParam}T00:00:00.000Z`) : new Date(defaults.from);
  const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : new Date(`${defaults.to}T23:59:59.999Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    const d = defaultAnalyticsRange();
    const fromD = new Date(`${d.from}T00:00:00.000Z`);
    const toD = new Date(`${d.to}T23:59:59.999Z`);
    return {
      from: fromD,
      to: toD,
      fromIso: d.from,
      toIso: d.to,
    };
  }
  return {
    from,
    to,
    fromIso: fromParam ?? defaults.from,
    toIso: toParam ?? defaults.to,
  };
}

export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return sorted[mid]!;
}
