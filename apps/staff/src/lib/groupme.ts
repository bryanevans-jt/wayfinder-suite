/**
 * GroupMe bot helpers for team birthday / work anniversary celebrations.
 * Requires GROUPME_BOT_ID in the staff app environment (Vercel).
 */

export function groupmeBotId(): string | null {
  const id = process.env.GROUPME_BOT_ID?.trim();
  return id || null;
}

export async function postGroupMeBotMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  const botId = groupmeBotId();
  if (!botId) {
    return { ok: false, error: "GROUPME_BOT_ID is not configured" };
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "Empty message" };
  }

  const res = await fetch("https://api.groupme.com/v3/bots/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_id: botId, text: trimmed }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      error: `GroupMe responded ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
    };
  }
  return { ok: true };
}

export function fillCelebrationTemplate(
  template: string,
  vars: { name: string; firstName: string; years?: number }
): string {
  return template
    .replaceAll("{name}", vars.name)
    .replaceAll("{first_name}", vars.firstName)
    .replaceAll("{years}", vars.years != null ? String(vars.years) : "");
}

/** True when local Eastern time is on/after 9:00 AM on the given UTC instant. */
export function isAtOrAfterEasternHour(now: Date, hourEt: number): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return hour >= hourEt;
}

/** MM-DD in America/New_York for the given instant. */
export function easternMonthDay(now: Date): { month: number; day: number; ymd: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return {
    month: Number(month),
    day: Number(day),
    ymd: `${year}-${month}-${day}`,
  };
}
