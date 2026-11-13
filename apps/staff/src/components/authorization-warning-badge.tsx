import type { AuthorizationWarningEvaluation } from "@wayfinder/supabase/authorization-warnings";
import {
  authorizationWarningListLabel,
  authorizationWarningTone,
} from "@wayfinder/supabase/authorization-warnings";

type Props = {
  evaluation?: AuthorizationWarningEvaluation | null;
  /** Precomputed label from API (portal client lists). */
  label?: string | null;
  tone?: "none" | "info" | "warn" | "alert" | null;
};

export function AuthorizationWarningBadge({ evaluation, label, tone }: Props) {
  const resolvedLabel = label ?? (evaluation ? authorizationWarningListLabel(evaluation) : null);
  if (!resolvedLabel) return null;
  const resolvedTone =
    tone ?? (evaluation ? authorizationWarningTone(evaluation) : "info");
  const classes =
    resolvedTone === "alert"
      ? "bg-red-100 text-red-800"
      : resolvedTone === "warn"
        ? "bg-amber-100 text-amber-900"
        : "bg-sky-100 text-sky-900";

  return (
    <span
      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${classes}`}
      title={`${resolvedLabel}. Soft warning only — actions are not blocked.`}
    >
      {resolvedLabel}
    </span>
  );
}
