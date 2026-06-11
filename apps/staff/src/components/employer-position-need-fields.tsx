"use client";

import {
  EMPLOYMENT_CATEGORIES,
  EMPLOYMENT_CATEGORY_LABELS,
  type EmploymentCategory,
} from "@wayfinder/branding";

type Props = {
  primaryCategory: EmploymentCategory | "";
  primaryOther: string;
  secondaryCategory: EmploymentCategory | "";
  secondaryOther: string;
  onPrimaryCategory: (value: EmploymentCategory | "") => void;
  onPrimaryOther: (value: string) => void;
  onSecondaryCategory: (value: EmploymentCategory | "") => void;
  onSecondaryOther: (value: string) => void;
  disabled?: boolean;
};

export function EmployerPositionNeedFields({
  primaryCategory,
  primaryOther,
  secondaryCategory,
  secondaryOther,
  onPrimaryCategory,
  onPrimaryOther,
  onSecondaryCategory,
  onSecondaryOther,
  disabled = false,
}: Props) {
  return (
    <fieldset className="space-y-4 rounded-lg border border-neutral-100 bg-neutral-50/60 p-3">
      <legend className="px-1 text-sm font-medium text-brand-black">
        Commonly hired position types
      </legend>
      <p className="text-xs text-brand-black/60">
        Select up to two position categories this employer most often hires for. These are used to
        suggest matches for clients with aligned employment goals within 10 miles.
      </p>
      <PositionRow
        label="Primary position type commonly hired"
        category={primaryCategory}
        other={primaryOther}
        onCategory={onPrimaryCategory}
        onOther={onPrimaryOther}
        disabled={disabled}
      />
      <PositionRow
        label="Secondary position type commonly hired (optional)"
        category={secondaryCategory}
        other={secondaryOther}
        onCategory={onSecondaryCategory}
        onOther={onSecondaryOther}
        disabled={disabled}
      />
    </fieldset>
  );
}

function PositionRow({
  label,
  category,
  other,
  onCategory,
  onOther,
  disabled,
}: {
  label: string;
  category: EmploymentCategory | "";
  other: string;
  onCategory: (value: EmploymentCategory | "") => void;
  onOther: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="font-medium">{label}</span>
        <select
          value={category}
          onChange={(e) => onCategory(e.target.value as EmploymentCategory | "")}
          disabled={disabled}
          className="rounded-lg border border-neutral-300 px-3 py-2"
        >
          <option value="">— Not set —</option>
          {EMPLOYMENT_CATEGORIES.map((key) => (
            <option key={key} value={key}>
              {EMPLOYMENT_CATEGORY_LABELS[key]}
            </option>
          ))}
        </select>
      </label>
      {category === "other" ? (
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Describe the position type</span>
          <input
            value={other}
            onChange={(e) => onOther(e.target.value)}
            disabled={disabled}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
      ) : null}
    </div>
  );
}

export function categoryFromDb(value: string | null | undefined): EmploymentCategory | "" {
  const key = (value ?? "").trim().toLowerCase();
  if ((EMPLOYMENT_CATEGORIES as readonly string[]).includes(key)) {
    return key as EmploymentCategory;
  }
  return "";
}
