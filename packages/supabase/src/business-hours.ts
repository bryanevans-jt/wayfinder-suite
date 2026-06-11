/** Business hours SLA: Mon–Fri, 48h excluding weekends. */
export function businessHoursBetween(start: Date, end: Date): number {
  if (end <= start) {
    return 0;
  }

  let hours = 0;
  const cursor = new Date(start);

  while (cursor < end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);
      const sliceEnd = end < dayEnd ? end : dayEnd;
      hours += (sliceEnd.getTime() - cursor.getTime()) / (1000 * 60 * 60);
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return hours;
}

export function isEsReplyOverdue(
  lastClientMessageAt: string | null | undefined,
  lastEsMessageAt: string | null | undefined
): boolean {
  if (!lastClientMessageAt) {
    return false;
  }
  const clientAt = new Date(lastClientMessageAt);
  const esAt = lastEsMessageAt ? new Date(lastEsMessageAt) : null;
  if (esAt && esAt >= clientAt) {
    return false;
  }
  return businessHoursBetween(clientAt, new Date()) >= 48;
}
