import type { AuthorizationWarningEvaluation } from "@wayfinder/supabase/authorization-warnings";
import {
  authorizationWarningListLabel,
  authorizationWarningTone,
} from "@wayfinder/supabase/authorization-warnings";

type Props = {
  evaluation: AuthorizationWarningEvaluation | null | undefined;
};

export function AuthorizationWarningBadge({ evaluation }: Props) {
  const label = evaluation ? authorizationWarningListLabel(evaluation) : null;
  if (!label) return null;
  const tone = authorizationWarningTone(evaluation!);
  const classes =
    tone === "alert"
      ? "bg-red-100 text-red-800"
      : tone === "warn"
        ? "bg-amber-100 text-amber-900"
        : "bg-sky-100 text-sky-900";

  return (
    <span
      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${classes}`}
      title={`${label}. Soft warning only — actions are not blocked.`}
    >
      {label}
    </span>
  );
}
