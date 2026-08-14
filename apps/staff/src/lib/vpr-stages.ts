export const VPR_SERVICE_STAGE_OPTIONS = [
  { value: "Job Development", label: "SE - Job Development" },
  { value: "Training / OS 1", label: "SE - Training / OS 1" },
  { value: "Training / OS 2", label: "SE - Training / OS 2" },
  { value: "Stabilization / ES", label: "SE - Stabilization / ES" },
  { value: "IJP", label: "IJP" },
  { value: "Work Readiness Training", label: "Work Readiness Training" },
  { value: "Work Evaluation", label: "Work Evaluation" },
  { value: "Job Coaching", label: "Job Coaching (Service)" },
  { value: "CWAT", label: "CWAT" },
] as const;

export type VprServiceStage = (typeof VPR_SERVICE_STAGE_OPTIONS)[number]["value"];

const VPR_STAGE_VALUES = new Set<string>(VPR_SERVICE_STAGE_OPTIONS.map((o) => o.value));

export function isVprServiceStage(value: string | null | undefined): value is VprServiceStage {
  return Boolean(value && VPR_STAGE_VALUES.has(value));
}

/** Map a Wayfinder milestone title (e.g. "Phase 2: Job Development") onto a VPR stage. */
export function matchVprStageFromTitle(title: string | null | undefined): VprServiceStage | "" {
  const raw = (title ?? "").trim();
  if (!raw) return "";
  const byLength = [...VPR_SERVICE_STAGE_OPTIONS].sort((a, b) => b.value.length - a.value.length);
  for (const opt of byLength) {
    if (raw === opt.value || raw === opt.label) return opt.value;
  }
  for (const opt of byLength) {
    if (raw.includes(opt.value)) return opt.value;
  }
  return "";
}

export function resolveReportingState(
  referralState: string | null | undefined,
  officeState: string | null | undefined,
  homeState: string | null | undefined
): "GA" | "TN" {
  for (const value of [referralState, officeState, homeState]) {
    const s = (value ?? "").trim().toUpperCase();
    if (s === "TN" || s === "GA") return s;
  }
  return "GA";
}
