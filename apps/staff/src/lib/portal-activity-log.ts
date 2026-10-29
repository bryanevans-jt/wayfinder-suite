/** Client-safe types and formatters for Reports → Audit Activity (no server imports). */

export type ActivityLogRow = {
  id: string;
  kind: "contact" | "application" | "stage" | "meeting" | "change";
  created_at: string;
  client_id: string;
  client_name: string | null;
  client_email: string | null;
  es_user_ids: string[];
  office_id: string | null;
  summary: string;
  detail: string | null;
};

function formatTimeAuditSnapshot(label: string, snap: Record<string, unknown>): string {
  const date = String(snap.service_date ?? "—");
  const mins = Number(snap.duration_minutes) || 0;
  const hours = Math.round((mins / 60) * 10) / 10;
  const start = snap.start_time ? String(snap.start_time) : "";
  const end = snap.end_time ? String(snap.end_time) : "";
  const timeRange =
    start && end ? `${start}–${end}` : start || end ? String(start || end) : "";
  return `${label}: ${date}, ${hours} hr${hours === 1 ? "" : "s"}${timeRange ? ` (${timeRange})` : ""}`;
}

export function buildContactLogChangeDetail(event: {
  event_kind: string;
  before_public_outcome: string | null;
  after_public_outcome: string | null;
  before_notes: string | null;
  after_notes: string | null;
  metadata: Record<string, unknown> | null | undefined;
}): string | null {
  const lines: string[] = [];
  const kind = event.event_kind;
  const meta = (event.metadata ?? {}) as Record<string, unknown>;

  if (meta.field === "service_time") {
    const before = meta.before as Record<string, unknown> | undefined;
    const after = meta.after as Record<string, unknown> | undefined;
    if (before && after) {
      lines.push(formatTimeAuditSnapshot("Service time before", before));
      lines.push(formatTimeAuditSnapshot("Service time after", after));
    }
  }

  const beforeOutcome = (event.before_public_outcome ?? "").trim();
  const afterOutcome = (event.after_public_outcome ?? "").trim();
  const beforeNotes = (event.before_notes ?? "").trim();
  const afterNotes = (event.after_notes ?? "").trim();

  if (kind === "created") {
    if (afterOutcome) lines.push(`Outcome added: ${afterOutcome}`);
    if (afterNotes) lines.push(`Notes added: ${afterNotes}`);
  } else if (kind === "deleted") {
    if (beforeOutcome) lines.push(`Outcome removed: ${beforeOutcome}`);
    if (beforeNotes) lines.push(`Notes removed: ${beforeNotes}`);
  } else {
    if (beforeOutcome !== afterOutcome) {
      lines.push(
        `Outcome: ${beforeOutcome || "(empty)"} → ${afterOutcome || "(empty)"}`
      );
    }
    if (beforeNotes !== afterNotes) {
      lines.push(`Notes: ${beforeNotes || "(empty)"} → ${afterNotes || "(empty)"}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

/** Human-readable detail line(s) for Audit Activity UI and exports. */
export function activityLogDetailText(row: ActivityLogRow): string {
  const detail = row.detail?.trim();
  if (detail) return detail;

  switch (row.kind) {
    case "stage":
      return "Stage milestone recorded.";
    case "application":
      return "Application record.";
    case "meeting":
      return "Meeting request.";
    default:
      return "";
  }
}
