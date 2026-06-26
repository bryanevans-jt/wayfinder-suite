import type { TagSchemaField } from "@/lib/tag-schema";

export const IPS_MONTHLY_SERVICE_SECTION = "Service information";

/** Display order for IPS Monthly Progress Report service phases (matches DHS VR form). */
export const IPS_MONTHLY_SERVICE_FIELD_ORDER = [
  "service1check",
  "s1start",
  "s1complete",
  "service2check",
  "s2start",
  "s2complete",
  "service3check",
  "s3start",
  "s3complete",
  "service4check",
  "s4start",
  "s4complete",
  "service5check",
  "s5complete",
  "service6check",
  "s6start",
  "s6complete",
] as const;

/** Canonical labels even when admin tag schema JSON is out of date. */
export const IPS_MONTHLY_SERVICE_LABELS: Record<string, string> = {
  service1check: "Career Development & Placement",
  s1start: "Career Development & Placement — Start Date",
  s1complete: "Career Development & Placement — Completion Date",
  service2check: "Job Stabilization",
  s2start: "Job Stabilization — Start Date",
  s2complete: "Job Stabilization — Completion Date",
  service3check: "30 Day Stabilization & Maintenance",
  s3start: "30 Day Stabilization & Maintenance — Start Date",
  s3complete: "30 Day Stabilization & Maintenance — Completion Date",
  service4check: "60 Day Stabilization & Maintenance",
  s4start: "60 Day Stabilization & Maintenance — Start Date",
  s4complete: "60 Day Stabilization & Maintenance — Completion Date",
  service5check: "90 Day Stabilization & Maintenance",
  s5complete: "90 Day Stabilization & Maintenance — Completion Date",
  service6check: "Re-Engaging with Individual",
  s6start: "Re-Engaging with Individual — Start Date",
  s6complete: "Re-Engaging with Individual — Completion Date",
};

export function isIpsMonthlyProgressSchema(fields: TagSchemaField[]): boolean {
  return fields.some((field) => field.key === "service1check");
}

export function orderIpsMonthlyServiceFields(fields: TagSchemaField[]): TagSchemaField[] {
  const order = new Map<string, number>(
    IPS_MONTHLY_SERVICE_FIELD_ORDER.map((key, index) => [key, index])
  );
  return [...fields].sort(
    (a, b) => (order.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.key) ?? Number.MAX_SAFE_INTEGER)
  );
}

export function applyIpsMonthlyServiceLabel(field: TagSchemaField): TagSchemaField {
  const label = IPS_MONTHLY_SERVICE_LABELS[field.key];
  return label ? { ...field, label } : field;
}

export function normalizeIpsMonthlyServiceFields(fields: TagSchemaField[]): TagSchemaField[] {
  if (!isIpsMonthlyProgressSchema(fields)) {
    return fields;
  }
  return orderIpsMonthlyServiceFields(fields).map(applyIpsMonthlyServiceLabel);
}
