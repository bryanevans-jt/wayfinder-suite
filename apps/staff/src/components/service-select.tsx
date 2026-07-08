"use client";

import type { ServiceSelectGroup } from "@wayfinder/branding";

type Props = {
  groups: ServiceSelectGroup[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  includeEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
};

export function ServiceSelect({
  groups,
  value,
  onChange,
  disabled = false,
  id,
  includeEmpty = false,
  emptyLabel = "Unassigned",
  className,
}: Props) {
  const hasOptions = groups.some((group) => group.options.length > 0);

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      disabled={disabled || !hasOptions}
    >
      {includeEmpty ? <option value="">{emptyLabel}</option> : null}
      {!hasOptions ? (
        <option value="">No services available</option>
      ) : (
        groups.map((group) => (
          <optgroup key={group.state ?? "general"} label={group.label}>
            {group.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </optgroup>
        ))
      )}
    </select>
  );
}
