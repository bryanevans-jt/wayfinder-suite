/** Title-case intake status labels for staff UI. */
export function intakeStatusLabel(status: string | null | undefined): string {
  const intake = (status ?? "").toLowerCase().trim();
  if (intake === "new_referral") return "New Referral";
  if (intake === "pending_authorization") return "Pending Authorization";
  if (intake === "discarded") return "Discarded";
  if (intake === "active") return "Active";
  if (!intake) return "Unknown";
  return intake
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function counselorDisplayStatus(opts: {
  intakeStatus: string | null | undefined;
  stageTitle: string | null | undefined;
}): string {
  const intake = (opts.intakeStatus ?? "active").toLowerCase();
  if (intake === "new_referral") return "New Referral";
  if (intake === "pending_authorization") return "Pending Authorization";
  if (intake === "discarded") return "Discarded";
  const stage = (opts.stageTitle ?? "").trim();
  if (/phase\s*1\s*:\s*intake/i.test(stage) || /^intake$/i.test(stage)) return "Needs Intake";
  return stage || "Active";
}

/** Queue / PDF stage column: intake label until active, then milestone title. */
export function referralStageLabel(opts: {
  intakeStatus: string | null | undefined;
  stageTitle: string | null | undefined;
}): string {
  const intake = (opts.intakeStatus ?? "").toLowerCase();
  if (intake && intake !== "active") return intakeStatusLabel(intake);
  const stage = (opts.stageTitle ?? "").trim();
  return stage || "Active";
}
