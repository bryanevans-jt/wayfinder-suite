import { formatBillableHours } from "./client-billable";

/**
 * Expected billable hours for a team member in a calendar month.
 *
 * Mid-month policy: a client counts toward the full monthly threshold if the
 * team member's assignment overlapped any part of the month (same overlap rule
 * as KRA compliance). Both assignees in a mid-month handoff therefore receive
 * the full per-client expectation for that month.
 */
export function expectedBillableMinutesForClients(
  clients: Array<{ thresholdHours: number }>
): number {
  return clients.reduce((sum, c) => {
    const hours = Number(c.thresholdHours);
    if (!Number.isFinite(hours) || hours <= 0) return sum;
    return sum + hours * 60;
  }, 0);
}

export function formatExpectedBillableHours(minutes: number): string {
  return formatBillableHours(minutes);
}
