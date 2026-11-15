/** Friendly labels for Pre-ETS invoice packet audit event kinds. */
export function preEtsInvoicePacketEventLabel(eventKind: string): string {
  switch (eventKind) {
    case "created":
      return "Created";
    case "status_changed":
      return "Status changed";
    case "pdf_generated":
      return "PDF generated";
    case "drive_archived":
      return "Archived to Drive";
    case "notes_updated":
      return "Notes updated";
    case "draft_totals_refreshed":
      return "Draft totals refreshed";
    default:
      return eventKind;
  }
}

/** Friendly labels for Pre-ETS authorization change-log event kinds. */
export function preEtsAuthorizationEventLabel(eventKind: string): string {
  switch (eventKind) {
    case "auth_number_changed":
      return "Authorization number changed";
    case "roster_students_changed":
      return "Roster students changed";
    default:
      return eventKind;
  }
}
