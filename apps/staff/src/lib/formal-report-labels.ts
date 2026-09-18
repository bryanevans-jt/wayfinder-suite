export const FORMAL_REPORT_LABELS: Record<string, string> = {
  seMonthly: "SE Monthly Report",
  vpr: "Vocational Progress Report",
  jtsgvmr: "JTSG Vocational Monthly Report",
  evf: "Employment Verification Form",
  jtsgtsvs: "JTSG Time Sheet",
};

export function formalReportLabel(slug: string): string {
  return FORMAL_REPORT_LABELS[slug] ?? slug;
}
