/** GVRA client-present guidance thresholds by service line. */
export function clientPresentGuidanceTarget(serviceName: string | null | undefined): {
  ratio: number;
  label: string;
} {
  const n = (serviceName ?? "").toLowerCase();
  if (n.includes("individual job placement") || n.includes("(ijp)")) {
    return { ratio: 0.25, label: "IJP (25%)" };
  }
  if (
    n.includes("supported employment") ||
    n.includes("traditional supported") ||
    /\bse\b/.test(n)
  ) {
    return { ratio: 0.5, label: "SE (50%)" };
  }
  return { ratio: 0.25, label: "vocational (25% default)" };
}
