/** Lower number = higher priority in the unified notification bell. */
const NOTIFICATION_PRIORITY: Record<string, number> = {
  message_sla_overdue: 10,
  meeting_pending: 20,
  meeting_reminder: 25,
  report_missing: 30,
  report_overdue: 35,
  timesheet_returned: 40,
  employment_celebration: 50,
  counselor_digest: 60,
  default: 100,
};

export function notificationPriority(kind: string): number {
  return NOTIFICATION_PRIORITY[kind] ?? NOTIFICATION_PRIORITY.default;
}

export function sortNotificationsByPriority<
  T extends { kind: string; created_at: string },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = notificationPriority(a.kind);
    const pb = notificationPriority(b.kind);
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
