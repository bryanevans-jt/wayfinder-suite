"use client";

import {
  filterOfficesForDirectory,
  groupOfficesForDirectory,
  listOfficeDirectoryGroups,
  type OfficeDirectoryRow,
  type OfficeDirectoryState,
} from "@/lib/office-directory";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type Props = {
  offices: OfficeDirectoryRow[];
  renderOffice: (office: OfficeDirectoryRow) => ReactNode;
};

export function OfficeDirectoryList({ offices, renderOffice }: Props) {
  const [stateFilter, setStateFilter] = useState<OfficeDirectoryState>("GA");
  const [groupFilter, setGroupFilter] = useState("");

  const groupOptions = useMemo(
    () => listOfficeDirectoryGroups(offices, stateFilter),
    [offices, stateFilter]
  );

  const filteredOffices = useMemo(
    () => filterOfficesForDirectory(offices, stateFilter, groupFilter),
    [offices, stateFilter, groupFilter]
  );

  const groupedOffices = useMemo(
    () => groupOfficesForDirectory(filteredOffices),
    [filteredOffices]
  );

  useEffect(() => {
    setGroupFilter("");
  }, [stateFilter]);

  useEffect(() => {
    if (groupFilter && !groupOptions.includes(groupFilter)) {
      setGroupFilter("");
    }
  }, [groupFilter, groupOptions]);

  const groupLabel = "District";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          aria-label={`Filter by ${groupLabel.toLowerCase()}`}
        >
          <option value="">All {groupLabel === "District" ? "districts" : "regions"}</option>
          {groupOptions.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>

        <p className="text-sm text-brand-black/60">
          {filteredOffices.length} office{filteredOffices.length === 1 ? "" : "s"}
          {groupFilter ? ` in ${groupFilter}` : ""}
        </p>
      </div>

      {groupedOffices.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white px-4 py-6 text-sm text-brand-black/60">
          No Georgia offices
          {groupFilter ? ` in this ${groupLabel.toLowerCase()}` : ""} yet.
        </p>
      ) : (
        <div className="space-y-6">
          {groupedOffices.map((group) => (
            <section key={group.label}>
              <h3 className="mb-2 text-sm font-semibold text-brand-black/75">
                {group.label}
                <span className="ml-2 font-normal text-brand-black/50">
                  ({group.offices.length})
                </span>
              </h3>
              <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
                {group.offices.map((office) => renderOffice(office))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
