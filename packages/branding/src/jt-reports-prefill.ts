import { JT_VOCATIONAL_REPORTS_URL } from "./constants";

export type JtReportPrefillType = "seMonthly" | "vpr" | "jtsgvmr" | "evf" | "jtsgtsvs";

/** Deep link into Joshua Tree Reports with client and ES names pre-filled (all fields remain editable there). */
export function buildJtReportsPrefillUrl(input: {
  clientName: string;
  esName?: string | null;
  report?: JtReportPrefillType;
}): string {
  const base = JT_VOCATIONAL_REPORTS_URL.replace(/\/$/, "");
  const path = base.endsWith("/reports") ? base : `${base}/reports`;
  const params = new URLSearchParams();
  if (input.clientName.trim()) {
    params.set("client", input.clientName.trim());
  }
  if (input.esName?.trim()) {
    params.set("es", input.esName.trim());
  }
  if (input.report) {
    params.set("report", input.report);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
