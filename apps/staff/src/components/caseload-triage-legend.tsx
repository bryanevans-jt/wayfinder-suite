import { TRIAGE_FLAG_META, type CaseloadTriageFlag } from "@wayfinder/supabase/caseload-triage";

const ORDER: CaseloadTriageFlag[] = [
  "no_contact",
  "stale_application",
  "meeting_pending",
  "se_monthly_due",
];

export function CaseloadTriageLegend() {
  return (
    <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-brand-black/75">
      <p className="font-semibold text-brand-black">Attention badges</p>
      <p className="mt-1">
        Clients who need follow-up appear first. Badges:{" "}
        {ORDER.map((flag, i) => (
          <span key={flag}>
            {i > 0 ? " · " : null}
            <strong>{TRIAGE_FLAG_META[flag].shortLabel}</strong> = {TRIAGE_FLAG_META[flag].label}
          </span>
        ))}
      </p>
    </div>
  );
}
