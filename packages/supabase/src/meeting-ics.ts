function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatIcsUtc(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildMeetingIcs(input: {
  uid: string;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  durationMinutes?: number;
}): string {
  const start = input.startsAt;
  const end = new Date(start.getTime() + (input.durationMinutes ?? 60) * 60 * 1000);
  const now = new Date();

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Joshua Tree Wayfinder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(input.uid)}`,
    `DTSTAMP:${formatIcsUtc(now)}`,
    `DTSTART:${formatIcsUtc(start)}`,
    `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:${escapeIcs(input.title)}`,
    `DESCRIPTION:${escapeIcs(input.description)}`,
    `LOCATION:${escapeIcs(input.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
