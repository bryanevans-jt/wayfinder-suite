/** Counselor-facing referral confirmation emails (on by default; set REFERRAL_SEND_COUNSELOR_CONFIRMATION=false to disable). */
export function shouldSendReferralCounselorConfirmationEmail(): boolean {
  const raw = (process.env.REFERRAL_SEND_COUNSELOR_CONFIRMATION ?? "").trim().toLowerCase();
  if (!raw) return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
