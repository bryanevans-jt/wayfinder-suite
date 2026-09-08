type Props = {
  ratio: number;
  totalMinutes: number;
  presentMinutes: number;
};

export function ClientPresentGuidanceBanner({ ratio, totalMinutes, presentMinutes }: Props) {
  if (totalMinutes === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-brand-black/75">
        GVRA guidance: at least 25% of billable activity in the last 30 days should include direct
        client contact. No billable time has been logged in the last 30 days yet.
      </p>
    );
  }

  const pct = Math.round(ratio * 100);
  const under = ratio < 0.25;

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        under
          ? "border-amber-300 bg-amber-50 text-amber-950"
          : "border-neutral-200 bg-neutral-50 text-brand-black/80"
      }`}
      role="status"
    >
      <p className="font-medium">
        Client contact (last 30 days): {pct}% ({presentMinutes} of {totalMinutes} billable minutes)
      </p>
      <p className="mt-1 text-brand-black/70">
        GVRA guidance suggests at least 25% of billable activity include direct client contact.
        This is informational only — exceptions apply.
      </p>
    </div>
  );
}
