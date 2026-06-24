import type { CaseloadTriageFlag } from "@wayfinder/supabase/caseload-triage";
import { TRIAGE_FLAG_META } from "@wayfinder/supabase/caseload-triage";

type Props = {
  flags: CaseloadTriageFlag[];
};

const FLAG_STYLES: Record<CaseloadTriageFlag, string> = {
  no_contact: "bg-amber-100 text-amber-900",
  stale_application: "bg-orange-100 text-orange-900",
  meeting_pending: "bg-sky-100 text-sky-900",
  se_monthly_due: "bg-red-100 text-red-800",
};

export function CaseloadTriageIcons({ flags }: Props) {
  if (flags.length === 0) return null;

  const sorted = [...flags].sort(
    (a, b) => TRIAGE_FLAG_META[a].priority - TRIAGE_FLAG_META[b].priority
  );

  return (
    <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
      {sorted.map((flag) => (
        <span
          key={flag}
          title={TRIAGE_FLAG_META[flag].label}
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${FLAG_STYLES[flag]}`}
        >
          {TRIAGE_FLAG_META[flag].shortLabel}
        </span>
      ))}
    </span>
  );
}
