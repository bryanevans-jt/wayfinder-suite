/** Counselor-facing referral confirmation emails (off by default during rollout). */
export function shouldSendReferralCounselorConfirmationEmail(): boolean {
  const raw = (process.env.REFERRAL_SEND_COUNSELOR_CONFIRMATION ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
