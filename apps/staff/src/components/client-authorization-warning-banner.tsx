import type { AuthorizationWarningEvaluation } from "@wayfinder/supabase/authorization-warnings";
import {
  authorizationWarningBannerCopy,
  authorizationWarningTone,
} from "@wayfinder/supabase/authorization-warnings";

type Props = {
  evaluation: AuthorizationWarningEvaluation | null | undefined;
};

export function ClientAuthorizationWarningBanner({ evaluation }: Props) {
  if (!evaluation?.applicable || evaluation.activeKinds.length === 0) return null;
  const copy = authorizationWarningBannerCopy(evaluation);
  if (!copy) return null;
  const tone = authorizationWarningTone(evaluation);
  const classes =
    tone === "alert"
      ? "border-red-200 bg-red-50 text-red-950"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-sky-200 bg-sky-50 text-sky-950";

  return (
    <div className={`mt-6 rounded-lg border px-4 py-3 text-sm ${classes}`} role="status">
      <p className="font-semibold">{copy.title}</p>
      <p className="mt-1">{copy.body}</p>
      <p className="mt-2 text-xs opacity-80">
        Soft warning only — billing, time entry, and casework are not limited or blocked.
      </p>
    </div>
  );
}
