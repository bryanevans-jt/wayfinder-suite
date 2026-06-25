export type TagFieldType =
  | "text"
  | "textarea"
  | "date"
  | "month"
  | "number"
  | "select"
  | "checkbox"
  | "boolean"
  | "radio";

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
};

export function parseTagSchema(raw: unknown): TagSchemaField[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is TagSchemaField =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as TagSchemaField).key === "string" &&
      typeof (item as TagSchemaField).label === "string" &&
      typeof (item as TagSchemaField).type === "string"
  );
}

export function tagSchemaLabels(fields: TagSchemaField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, f.label]));
}

export function tagSchemaOrderedKeys(fields: TagSchemaField[]): string[] {
  return fields.map((f) => f.key);
}
