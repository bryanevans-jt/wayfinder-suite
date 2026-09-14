export type PreEtsDemoStep = {
  id: number;
  title: string;
  summary: string;
};

export const PRE_ETS_DEMO_STEPS: PreEtsDemoStep[] = [
  {
    id: 1,
    title: "Supervisor uploads Valdosta",
    summary:
      "Supervisor uploads the district CSV with Valdosta High students only. Pending roster and authorization request are created; Accounts get a batched notification.",
  },
  {
    id: 2,
    title: "Accounts notified",
    summary:
      "Accounts Specialist sees: Authorization requests submitted for Valdosta High. Lowndes is not in the file yet.",
  },
  {
    id: 3,
    title: "Accounts finalizes Valdosta",
    summary:
      "Accounts enters the GVRA authorization number, adjusts the roster if needed, and saves. Valdosta is released to TS/TI immediately.",
  },
  {
    id: 4,
    title: "TS/TI sees Valdosta only",
    summary:
      "Transition Specialist can schedule sessions and print rosters for Valdosta. Lowndes still does not appear until it is finalized.",
  },
  {
    id: 5,
    title: "Supervisor adds Lowndes",
    summary:
      "Supervisor re-uploads the spreadsheet with Valdosta + Lowndes students. No duplicate Valdosta auth; Lowndes pending auth is created; Accounts notified again.",
  },
];

export type PreEtsDemoRole = "supervisor" | "accounts" | "field";

export function demoPanelHint(role: PreEtsDemoRole, step: number): string {
  if (role === "supervisor") {
    if (step <= 1)
      return "Worksheets — upload planning CSV (sample below). Schools & groups shows Valdosta pending authorization.";
    if (step >= 5)
      return "Re-upload same month with Lowndes; Valdosta is not duplicated; pipeline adds Lowndes as pending.";
    return "Schools & groups + Rosters — track Valdosta/Lowndes status for your region.";
  }
  if (role === "accounts") {
    if (step <= 2) return "Notification bell + Rosters & auths → Pending → Enter authorization.";
    if (step === 3) return "Finalize modal: auth number + editable roster (add/remove students).";
    return "After Valdosta finalize, Lowndes remains pending until its auth number is entered.";
  }
  if (step < 4) {
    return "Sessions & Rosters — no Valdosta access yet (authorization number not entered).";
  }
  if (step === 4) {
    return "Valdosta appears in Sessions and roster PDFs; Lowndes still hidden.";
  }
  return "Lowndes stays hidden until Accounts finalizes it separately.";
}
