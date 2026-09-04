export type ServiceRowInput = {
  id: string;
  name: string;
  state?: string | null;
};

export type ServiceSelectOption = {
  id: string;
  name: string;
};

export type ServiceSelectGroup = {
  state: string | null;
  label: string;
  options: ServiceSelectOption[];
};

export type ServiceSelectOptions = {
  /** When true, include Customized Supported Employment in pickers. Default: hidden. */
  includeCustomizedSupportedEmployment?: boolean;
  /** When true, include Traditional Supported Employment in pickers. Default: hidden. */
  includeTraditionalSupportedEmployment?: boolean;
  /** When true, include Job Coaching in pickers. Default: hidden. */
  includeJobCoaching?: boolean;
  /** When true (default), hide Tennessee services from pickers. */
  excludeTennessee?: boolean;
};

const STATE_GROUP_LABELS: Record<string, string> = {
  GA: "Georgia",
  TN: "Tennessee",
};

const STATE_GROUP_ORDER = ["GA", "TN"];

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

/** Legacy TN TSE row superseded by "Supported Employment (TN)". */
export function isDeprecatedTnTraditionalService(row: ServiceRowInput): boolean {
  const { baseName, state } = parseServiceParts(row.name, row.state);
  return baseName.toLowerCase() === "traditional supported employment" && state === "TN";
}

/** GA Customized Supported Employment (optionally hidden from pickers). */
export function isCustomizedSupportedEmploymentService(row: ServiceRowInput): boolean {
  const { baseName } = parseServiceParts(row.name, row.state);
  return baseName.toLowerCase() === "customized supported employment";
}

function findSupportedTnServiceId(rows: ServiceRowInput[]): string | null {
  for (const row of rows) {
    const { baseName, state } = parseServiceParts(row.name, row.state);
    if (baseName.toLowerCase() === "supported employment" && state === "TN") {
      return row.id;
    }
  }
  return null;
}

/** Map a client's stored service id to the canonical TN supported employment row when needed. */
export function resolveClientServiceIdForEdit(
  rows: ServiceRowInput[],
  currentServiceId: string | null
): string | null {
  if (!currentServiceId) return null;
  const current = rows.find((r) => r.id === currentServiceId);
  if (current && isDeprecatedTnTraditionalService(current)) {
    return findSupportedTnServiceId(rows);
  }
  return currentServiceId;
}

/** GA Traditional Supported Employment (not Customized). */
export function isTraditionalSupportedEmploymentService(row: ServiceRowInput): boolean {
  const { baseName } = parseServiceParts(row.name, row.state);
  return baseName.toLowerCase() === "traditional supported employment";
}

export function isJobCoachingService(row: ServiceRowInput): boolean {
  const { baseName } = parseServiceParts(row.name, row.state);
  return baseName.toLowerCase() === "job coaching";
}

function activeServicesForSelect(
  rows: ServiceRowInput[],
  options?: ServiceSelectOptions
): ServiceRowInput[] {
  const excludeTn = options?.excludeTennessee !== false;
  return rows.filter((r) => {
    if (isDeprecatedTnTraditionalService(r)) return false;
    const { state } = parseServiceParts(r.name, r.state);
    if (excludeTn && state === "TN") return false;
    if (
      !options?.includeCustomizedSupportedEmployment &&
      isCustomizedSupportedEmploymentService(r)
    ) {
      return false;
    }
    if (
      !options?.includeTraditionalSupportedEmployment &&
      isTraditionalSupportedEmploymentService(r)
    ) {
      return false;
    }
    if (!options?.includeJobCoaching && isJobCoachingService(r)) {
      return false;
    }
    return true;
  });
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
export function dedupeServicesForSelect(
  rows: ServiceRowInput[],
  options?: ServiceSelectOptions
): ServiceSelectOption[] {
  const byBase = new Map<
    string,
    Array<{ row: ServiceRowInput; parts: ReturnType<typeof parseServiceParts> }>
  >();

  for (const row of activeServicesForSelect(rows, options)) {
    const parts = parseServiceParts(row.name, row.state);
    const key = parts.baseName.toLowerCase();
    const list = byBase.get(key) ?? [];
    list.push({ row, parts });
    byBase.set(key, list);
  }

  const selectOptions: ServiceSelectOption[] = [];

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
      selectOptions.push({
        id: row.id,
        name: formatServiceLabel(parts.baseName, parts.state),
      });
    }
  }

  return selectOptions.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

function stateGroupLabel(state: string | null): string {
  if (!state) return "General";
  const name = STATE_GROUP_LABELS[state];
  return name ? `${name} (${state})` : state;
}

function sortStateGroups(groups: ServiceSelectGroup[]): ServiceSelectGroup[] {
  return groups.sort((a, b) => {
    const ai = a.state ? STATE_GROUP_ORDER.indexOf(a.state) : 999;
    const bi = b.state ? STATE_GROUP_ORDER.indexOf(b.state) : 999;
    const aRank = ai >= 0 ? ai : 998;
    const bRank = bi >= 0 ? bi : 998;
    if (aRank !== bRank) return aRank - bRank;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
}

/** Keep services that match an office state (or have no state when office is unset). */
export function filterServicesForOfficeState(
  rows: ServiceRowInput[],
  officeState: string | null | undefined,
  options?: ServiceSelectOptions
): ServiceRowInput[] {
  const normalizedOfficeState = officeState?.trim().toUpperCase() || null;
  if (!normalizedOfficeState) {
    return activeServicesForSelect(rows, options);
  }

  return activeServicesForSelect(rows, options).filter((row) => {
    const { state } = parseServiceParts(row.name, row.state);
    return state === normalizedOfficeState;
  });
}

/** Service dropdown groups by state, optionally limited to one office state. */
export function servicesGroupedByState(
  rows: ServiceRowInput[],
  officeState?: string | null,
  selectOptions?: ServiceSelectOptions
): ServiceSelectGroup[] {
  const filtered = filterServicesForOfficeState(rows, officeState, selectOptions);
  const options = dedupeServicesForSelect(filtered, selectOptions);
  const byState = new Map<string, ServiceSelectGroup>();

  for (const option of options) {
    const { state } = parseServiceParts(option.name, null);
    const key = state ?? "";
    const group =
      byState.get(key) ??
      ({
        state,
        label: stateGroupLabel(state),
        options: [],
      } satisfies ServiceSelectGroup);
    group.options.push(option);
    byState.set(key, group);
  }

  for (const group of byState.values()) {
    group.options.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }

  return sortStateGroups([...byState.values()]);
}

function appendLegacyServiceGroup(
  groups: ServiceSelectGroup[],
  rows: ServiceRowInput[],
  serviceId: string
): ServiceSelectGroup[] {
  // Include currently-assigned services even when the offering is disabled.
  const row = rows.find(
    (r) => r.id === serviceId && !isDeprecatedTnTraditionalService(r)
  );
  if (!row || groups.some((g) => g.options.some((o) => o.id === serviceId))) {
    return groups;
  }

  const { state } = parseServiceParts(row.name, row.state);
  const key = state ?? "";
  const next = groups.map((g) => ({
    ...g,
    options: [...g.options],
  }));
  let group = next.find((g) => (g.state ?? "") === key);
  if (!group) {
    group = {
      state,
      label: stateGroupLabel(state),
      options: [],
    };
    next.push(group);
  }
  group.options.push({
    id: row.id,
    name: serviceDisplayName(row),
  });
  group.options.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  return sortStateGroups(next);
}

/** Service dropdown groups for editing a client, including legacy service ids. */
export function servicesForClientEditGroups(
  rows: ServiceRowInput[],
  currentServiceId: string | null,
  officeState?: string | null,
  selectOptions?: ServiceSelectOptions
): ServiceSelectGroup[] {
  const effectiveCurrentId = resolveClientServiceIdForEdit(rows, currentServiceId);
  let groups = servicesGroupedByState(rows, officeState, selectOptions);
  if (effectiveCurrentId) {
    groups = appendLegacyServiceGroup(groups, rows, effectiveCurrentId);
  }
  return groups;
}

export function flattenServiceGroups(groups: ServiceSelectGroup[]): ServiceSelectOption[] {
  return groups.flatMap((group) => group.options);
}

/** Service dropdown options for editing a client, including legacy service ids. */
export function servicesForClientEdit(
  rows: ServiceRowInput[],
  currentServiceId: string | null,
  officeState?: string | null,
  selectOptions?: ServiceSelectOptions
): ServiceSelectOption[] {
  return flattenServiceGroups(
    servicesForClientEditGroups(rows, currentServiceId, officeState, selectOptions)
  );
}
