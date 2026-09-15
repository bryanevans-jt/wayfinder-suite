"use client";

import { useEffect, useMemo, useState } from "react";

export type FieldSpecialistOption = {
  userId: string;
  fullName: string;
  role: "es" | "transition_specialist" | "supervisor";
  group: "office_es" | "office_ts" | "other";
};

function roleSuffix(role: FieldSpecialistOption["role"]): string {
  if (role === "transition_specialist") return "TS";
  if (role === "supervisor") return "Supervisor";
  return "ES";
}

type Props = {
  officeId: string | null;
  value: string;
  disabled?: boolean;
  onChange: (userId: string) => void;
};

export function ReferralFieldSpecialistSelect({ officeId, value, disabled, onChange }: Props) {
  const [options, setOptions] = useState<FieldSpecialistOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const qs = officeId ? `?officeId=${encodeURIComponent(officeId)}` : "";
        const res = await fetch(`/api/referrals/field-specialists${qs}`);
        const data = (await res.json()) as { options?: FieldSpecialistOption[] };
        if (!cancelled && res.ok) {
          setOptions(data.options ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [officeId]);

  const groups = useMemo(() => {
    const officeEs = options.filter((o) => o.group === "office_es");
    const officeTs = options.filter((o) => o.group === "office_ts");
    const other = options.filter((o) => o.group === "other");
    return { officeEs, officeTs, other };
  }, [options]);

  return (
    <label className="block text-sm">
      <span className="font-medium">Assign ES / TS</span>
      <select
        className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm disabled:opacity-50"
        value={value}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{loading ? "Loading staff…" : "Select specialist…"}</option>
        {groups.officeEs.length > 0 ? (
          <optgroup label="Office — Employment Specialists">
            {groups.officeEs.map((o) => (
              <option key={o.userId} value={o.userId}>
                {o.fullName} ({roleSuffix(o.role)})
              </option>
            ))}
          </optgroup>
        ) : null}
        {groups.officeTs.length > 0 ? (
          <optgroup label="Office — Transition Specialists">
            {groups.officeTs.map((o) => (
              <option key={o.userId} value={o.userId}>
                {o.fullName} ({roleSuffix(o.role)})
              </option>
            ))}
          </optgroup>
        ) : null}
        {groups.other.length > 0 ? (
          <optgroup label="All other field specialists & supervisors">
            {groups.other.map((o) => (
              <option key={o.userId} value={o.userId}>
                {o.fullName} ({roleSuffix(o.role)})
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </label>
  );
}
