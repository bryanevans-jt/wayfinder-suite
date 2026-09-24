export const DISCARD_REFERRAL_CONFIRM_MESSAGE =
  "Are you sure you want to discard this referral?";

export function confirmDiscardReferral(): boolean {
  return confirm(DISCARD_REFERRAL_CONFIRM_MESSAGE);
}
