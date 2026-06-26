export type TagFieldType =
  | "text"
  | "textarea"
  | "date"
  | "month"
  | "number"
  | "select"
  | "checkbox"
  | "boolean"
  | "radio"
  | "table_row";

export type TagSchemaField = {
  key: string;
  label: string;
  type: TagFieldType;
  required?: boolean;
  readOnly?: boolean;
  prefill?: string;
  section?: string;
  help?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  /** For type "radio": shared group name; each field key is one option rendered as ☑/☐ in the PDF. */
  group?: string;
  /** Heading shown once for a radio group (use on any member of the group). */
  groupLabel?: string;
  /** For type "table_row": competency text shown in the first column. */
  rowLabel?: string;
  /** For type "table_row": placeholder keys in the Google Doc template. */
  trainingKey?: string;
  dateKey?: string;
  commentsKey?: string;
};

function isTableRowField(
  item: unknown
): item is TagSchemaField & {
  type: "table_row";
  trainingKey: string;
  dateKey: string;
  commentsKey: string;
} {
  if (typeof item !== "object" || item === null) return false;
  const field = item as TagSchemaField;
  return (
    field.type === "table_row" &&
    typeof field.key === "string" &&
    typeof field.trainingKey === "string" &&
    typeof field.dateKey === "string" &&
    typeof field.commentsKey === "string"
  );
}

export function parseTagSchema(raw: unknown): TagSchemaField[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is TagSchemaField => {
    if (typeof item !== "object" || item === null) return false;
    const field = item as TagSchemaField;
    if (typeof field.key !== "string" || typeof field.type !== "string") return false;
    if (field.type === "table_row") {
      return (
        typeof field.trainingKey === "string" &&
        typeof field.dateKey === "string" &&
        typeof field.commentsKey === "string"
      );
    }
    return typeof field.label === "string";
  });
}

export function tagSchemaLabels(fields: TagSchemaField[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const field of fields) {
    if (isTableRowField(field)) {
      const prefix = field.rowLabel || field.label;
      labels[field.trainingKey] = `${prefix} — Training needed?`;
      labels[field.dateKey] = `${prefix} — Date provided`;
      labels[field.commentsKey] = `${prefix} — Comments`;
      continue;
    }
    labels[field.key] = field.label;
  }
  return labels;
}

export function tagSchemaOrderedKeys(fields: TagSchemaField[]): string[] {
  const keys: string[] = [];
  for (const field of fields) {
    if (isTableRowField(field)) {
      keys.push(field.trainingKey, field.dateKey, field.commentsKey);
      continue;
    }
    if (field.type === "radio") continue;
    keys.push(field.key);
  }
  return keys;
}
