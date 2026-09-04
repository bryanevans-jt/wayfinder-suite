"use client";

/**
 * Legacy CSE-only panel. Prefer Settings → Feature Toggles for all service/network flags.
 */
export function ServiceOfferingsPanel() {
  return (
    <section className="max-w-xl space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-black">Service Offerings</h2>
      <p className="text-sm text-brand-black/75">
        Service and network toggles (including Customized Supported Employment, Traditional
        Supported Employment, Job Coaching, and Community Partners) are managed under{" "}
        <span className="font-medium text-brand-black">Settings → Feature Toggles</span>.
      </p>
      <p className="text-sm text-brand-black/60">
        This screen is kept for navigation compatibility and no longer edits offerings directly.
      </p>
    </section>
  );
}
