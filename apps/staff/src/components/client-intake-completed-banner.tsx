import { formatPortalDateTime, PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";

type Props = {
  completedAt: string;
  timezone?: string;
};

export function ClientIntakeCompletedBanner({ completedAt, timezone }: Props) {
  const tz = timezone?.trim() || PORTAL_DISPLAY_TIME_ZONE;
  return (
    <p className="rounded-lg border border-brand-green/25 bg-brand-green/5 px-4 py-3 text-sm text-brand-black/85">
      <span className="font-semibold text-brand-black">Intake completed</span> on{" "}
      {formatPortalDateTime(completedAt, tz)}. Intake scheduling is closed for this enrollment.
      Contact Hospitality or your supervisor if the client did not attend and intake must be
      rescheduled.
    </p>
  );
}
