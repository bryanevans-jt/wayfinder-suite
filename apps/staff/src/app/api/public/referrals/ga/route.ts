import {
  handlePublicReferralPost,
  handlePublicReferralServicesGet,
  OPTIONS,
} from "@/lib/public-referral-handler";

export { OPTIONS };

export async function GET(request: Request) {
  return handlePublicReferralServicesGet(request);
}

export async function POST(request: Request) {
  return handlePublicReferralPost(request, "GA");
}
