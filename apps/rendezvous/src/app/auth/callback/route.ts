import { rendezvousServerAuthOptions } from "@/lib/supabase/auth-options";
import { handleWayfinderAuthCallback } from "@wayfinder/supabase/auth-callback";
import { JOSHUA_TREE_ORG_EMAIL_DOMAIN } from "@wayfinder/branding";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  if (!url.searchParams.get("next")) {
    url.searchParams.set("next", "/");
  }
  const callbackRequest =
    url.toString() === request.url ? request : new NextRequest(url.toString(), request);

  return handleWayfinderAuthCallback(callbackRequest, {
    serverAuthOptions: rendezvousServerAuthOptions,
    requireProvisionedProfile: true,
    allowedEmailDomain: JOSHUA_TREE_ORG_EMAIL_DOMAIN,
  });
}
