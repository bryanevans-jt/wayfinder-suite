export type ServiceRowInput = {
  id: string;
  name: string;
  state?: string | null;
};

export type ServiceSelectOption = {
  id: string;
  name: string;
};

const STATE_SUFFIX_RE = /\s+\(([A-Z]{2})\)\s*$/;

/** Split a service name into base title and optional state code. */
export function parseServiceParts(
  name: string,
  stateColumn?: string | null
): { baseName: string; state: string | null } {
  const trimmed = name.trim();
  const match = trimmed.match(STATE_SUFFIX_RE);
  let baseName = trimmed;
  let state = stateColumn?.trim().toUpperCase() || null;

  if (match) {
    baseName = trimmed.slice(0, match.index).trim();
    state = state ?? match[1];
  }

  return { baseName, state };
}

export function formatServiceLabel(baseName: string, state: string | null): string {
  return state ? `${baseName} (${state})` : baseName;
}

/** Display label for any service row (client tables, etc.). */
export function serviceDisplayName(row: ServiceRowInput): string {
  const { baseName, state } = parseServiceParts(row.name, row.state);
  return formatServiceLabel(baseName, state);
}

function pickPreferredService(
  entries: Array<{ row: ServiceRowInput; parts: ReturnType<typeof parseServiceParts> }>
): ServiceRowInput {
  return entries
    .slice()
    .sort((a, b) => {
      const rank = (entry: typeof a) => {
        let score = 0;
        if (entry.parts.state) score += 2;
        if (entry.row.state?.trim()) score += 1;
        return score;
      };
      const diff = rank(b) - rank(a);
      if (diff !== 0) return diff;
      return a.row.id.localeCompare(b.row.id);
    })[0].row;
}

/**
 * Collapse legacy duplicate services for dropdowns:
 * - "Individual Job Placement" + "Individual Job Placement (GA)" → one GA row
 * - Exact duplicate names → one row
 * - Different states (GA vs TN) stay separate
 */
export function dedupeServicesForSelect(rows: ServiceRowInput[]): ServiceSelectOption[] {
  const byBase = new Map<
    string,
    Array<{ row: ServiceRowInput; parts: ReturnType<typeof parseServiceParts> }>
  >();

  for (const row of rows) {
    const parts = parseServiceParts(row.name, row.state);
    const key = parts.baseName.toLowerCase();
    const list = byBase.get(key) ?? [];
    list.push({ row, parts });
    byBase.set(key, list);
  }

  const options: ServiceSelectOption[] = [];

  for (const entries of byBase.values()) {
    const byState = new Map<
      string,
      Array<{ row: ServiceRowInput; parts: ReturnType<typeof parseServiceParts> }>
    >();

    for (const entry of entries) {
      const stateKey = entry.parts.state ?? "";
      const list = byState.get(stateKey) ?? [];
      list.push(entry);
      byState.set(stateKey, list);
    }

    const hasStatefulVariant = [...byState.keys()].some((key) => key !== "");

    for (const [stateKey, stateEntries] of byState) {
      if (stateKey === "" && hasStatefulVariant) {
        continue;
      }

      const row = pickPreferredService(stateEntries);
      const parts = parseServiceParts(row.name, row.state);
      options.push({
        id: row.id,
        name: formatServiceLabel(parts.baseName, parts.state),
      });
    }
  }

  return options.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

/** Service dropdown options for editing a client, including legacy service ids. */
export function servicesForClientEdit(
  rows: ServiceRowInput[],
  currentServiceId: string | null
): ServiceSelectOption[] {
  const options = dedupeServicesForSelect(rows);
  if (currentServiceId && !options.some((o) => o.id === currentServiceId)) {
    const row = rows.find((r) => r.id === currentServiceId);
    if (row) {
      options.push({
        id: row.id,
        name: serviceDisplayName(row),
      });
      options.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
    }
  }
  return options;
}
