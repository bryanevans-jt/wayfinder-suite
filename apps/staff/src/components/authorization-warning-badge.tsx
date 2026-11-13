import type { AuthorizationWarningListFlag } from "@wayfinder/supabase/authorization-warnings-shared";

type Props = {
  flag?: AuthorizationWarningListFlag | null;
  label?: string | null;
  tone?: "none" | "info" | "warn" | "alert" | null;
};

/** Presentational only — must not import server modules (notify-user / web-push). */
export function AuthorizationWarningBadge({ flag, label, tone }: Props) {
  const resolvedLabel = label ?? flag?.label ?? null;
  if (!resolvedLabel) return null;
  const resolvedTone = tone ?? flag?.tone ?? "info";
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
