const GVRA_REFERRAL_URL = "https://www.thejoshuatree.org/gvra";

export function CounselorSubmitReferralLink({ className = "" }: { className?: string }) {
  return (
    <a
      href={GVRA_REFERRAL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ||
        "inline-flex items-center rounded-lg border border-brand-green bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90"
      }
    >
      Submit a referral
    </a>
  );
}
