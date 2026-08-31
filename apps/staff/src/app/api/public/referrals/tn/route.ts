import { OPTIONS, publicReferralClosedResponse } from "@/lib/public-referral-handler";

export { OPTIONS };

export async function POST(request: Request) {
  return publicReferralClosedResponse(
    request,
    "Joshua Tree is no longer accepting new Tennessee VR referrals."
  );
}
