export type OfficeDirectoryState = "GA" | "TN";

export type OfficeDirectoryRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_hidden?: boolean;
};

export function resolveOfficeDirectoryState(
  office: Pick<OfficeDirectoryRow, "state" | "name">
): OfficeDirectoryState | null {
  const state = office.state?.trim().toUpperCase();
  if (state === "GA" || state === "TN") return state;
  return null;
}

/** District (GA) or region (TN) label from the office name suffix after " - ". */
export function parseOfficeDistrictOrRegion(name: string): string | null {
  const separator = " - ";
  const idx = name.indexOf(separator);
  if (idx === -1) return null;
  const label = name.slice(idx + separator.length).trim();
  return label || null;
}

export function officeDirectoryGroupLabel(name: string): string {
  return parseOfficeDistrictOrRegion(name) ?? "Other";
}

function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

export function filterOfficesForDirectory(
  offices: OfficeDirectoryRow[],
  state: OfficeDirectoryState,
  groupFilter: string
): OfficeDirectoryRow[] {
  return offices.filter((office) => {
    if (resolveOfficeDirectoryState(office) !== state) return false;
    if (!groupFilter) return true;
    return officeDirectoryGroupLabel(office.name) === groupFilter;
  });
}

export function listOfficeDirectoryGroups(
  offices: OfficeDirectoryRow[],
  state: OfficeDirectoryState
): string[] {
  const labels = new Set<string>();
  for (const office of offices) {
    if (resolveOfficeDirectoryState(office) !== state) continue;
    labels.add(officeDirectoryGroupLabel(office.name));
  }
  return [...labels].sort(compareLabels);
}

export type OfficeDirectoryGroup<T extends OfficeDirectoryRow> = {
  label: string;
  offices: T[];
};

export function groupOfficesForDirectory<T extends OfficeDirectoryRow>(
  offices: T[]
): OfficeDirectoryGroup<T>[] {
  const map = new Map<string, T[]>();

  for (const office of offices) {
    const label = officeDirectoryGroupLabel(office.name);
    const bucket = map.get(label) ?? [];
    bucket.push(office);
    map.set(label, bucket);
  }

  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return compareLabels(a, b);
    })
    .map(([label, groupOffices]) => ({
      label,
      offices: [...groupOffices].sort((a, b) => compareLabels(a.name, b.name)),
    }));
}
