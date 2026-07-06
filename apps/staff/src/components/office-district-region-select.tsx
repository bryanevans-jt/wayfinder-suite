import { districtOrRegionOptionsForState } from "@/lib/office-directory";

type Props = {
  state: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function OfficeDistrictRegionSelect({
  state,
  value,
  onChange,
  disabled = false,
  className = "rounded-lg border border-neutral-300 px-3 py-1.5",
}: Props) {
  const options = districtOrRegionOptionsForState(state);
  if (options.length === 0) return null;

  const label = state.trim().toUpperCase() === "TN" ? "Region" : "District";

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      aria-label={label}
      disabled={disabled}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
