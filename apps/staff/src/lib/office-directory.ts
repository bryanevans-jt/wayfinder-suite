export type OfficeDirectoryState = "GA" | "TN";

export const GA_DISTRICT_OPTIONS = Array.from({ length: 10 }, (_, index) => `District ${index + 1}`);
export const TN_REGION_OPTIONS = Array.from({ length: 11 }, (_, index) => `Region ${index + 1}`);

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

/** Office location label before the ` - District/Region` suffix. */
export function officeBaseName(name: string): string {
  const separator = " - ";
  const idx = name.indexOf(separator);
  if (idx === -1) return name.trim();
  return name.slice(0, idx).trim();
}

export function buildOfficeDisplayName(baseName: string, districtOrRegion: string): string {
  const base = baseName.trim();
  const group = districtOrRegion.trim();
  if (!base) return group;
  if (!group) return base;
  return `${base} - ${group}`;
}

export function districtOrRegionOptionsForState(state: string): string[] {
  const normalized = state.trim().toUpperCase();
  if (normalized === "TN") return TN_REGION_OPTIONS;
  if (normalized === "GA") return GA_DISTRICT_OPTIONS;
  return [];
}

export function defaultDistrictOrRegionForState(state: string): string {
  const options = districtOrRegionOptionsForState(state);
  return options[0] ?? "";
}

export function coerceDistrictOrRegionForState(value: string, state: string): string {
  const options = districtOrRegionOptionsForState(state);
  if (options.length === 0) return "";
  if (options.includes(value)) return value;

  const numberMatch = value.match(/(\d+)/);
  const number = numberMatch ? Number.parseInt(numberMatch[1], 10) : 1;
  const kind = state.trim().toUpperCase() === "TN" ? "Region" : "District";
  const max = kind === "Region" ? 11 : 10;
  const clamped = Math.min(Math.max(number, 1), max);
  const candidate = `${kind} ${clamped}`;
  return options.includes(candidate) ? candidate : options[0];
}

export function inferDistrictOrRegionFromOffice(
  office: Pick<OfficeDirectoryRow, "name" | "state">
): string {
  const state = resolveOfficeDirectoryState(office) ?? "GA";
  const parsed = parseOfficeDistrictOrRegion(office.name);
  if (parsed) return coerceDistrictOrRegionForState(parsed, state);
  return defaultDistrictOrRegionForState(state);
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
