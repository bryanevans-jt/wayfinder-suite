import { handlePublicReferralPost, OPTIONS } from "@/lib/public-referral-handler";

export { OPTIONS };

export async function POST(request: Request) {
  return handlePublicReferralPost(request, "TN");
}
