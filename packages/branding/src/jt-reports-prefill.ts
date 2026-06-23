import { JT_VOCATIONAL_REPORTS_URL } from "./constants";

export type JtReportPrefillType = "seMonthly" | "vpr" | "jtsgvmr" | "evf" | "jtsgtsvs";

/** Base URL for the integrated reports app (Wayfinder monorepo). Falls back to legacy URL. */
export function reportsAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_REPORTS_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return JT_VOCATIONAL_REPORTS_URL.replace(/\/$/, "");
}

/** Launch URL for formal reporting inside Wayfinder Pro. */
export function buildReportsAppUrl(path = "/reports"): string {
  const base = reportsAppBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/** Deep link into reporting with client and ES names pre-filled (all fields remain editable). */
export function buildJtReportsPrefillUrl(input: {
  clientName: string;
  esName?: string | null;
  report?: JtReportPrefillType;
  wayfinderClientId?: string | null;
}): string {
  const base = reportsAppBaseUrl();
  const path = base.includes("/reports") ? base : `${base}/reports`;
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
  if (input.wayfinderClientId?.trim()) {
    params.set("clientId", input.wayfinderClientId.trim());
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
