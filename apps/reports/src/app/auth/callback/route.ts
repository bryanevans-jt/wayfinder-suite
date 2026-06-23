import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_DOMAIN, SUPERADMIN_EMAIL } from "@/lib/constants";
import { handleWayfinderAuthCallback } from "@wayfinder/supabase/auth-callback";
import { NextRequest } from "next/server";

async function seedReportRoles(userId: string, email: string | null) {
  if (!email?.endsWith(`@${ORG_DOMAIN}`)) return;

  const admin = createAdminClient();
  if (email === SUPERADMIN_EMAIL) {
    await admin.from("report_user_roles").upsert(
      { user_id: userId, role: "superadmin" },
      { onConflict: "user_id" }
    );
    return;
  }

  const { data: invite } = await admin
    .from("supervisor_invites")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (invite) {
    await admin.from("report_user_roles").upsert(
      { user_id: userId, role: "supervisor" },
      { onConflict: "user_id" }
    );
    await admin.from("supervisor_invites").delete().eq("id", invite.id);
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  if (!url.searchParams.get("next")) {
    url.searchParams.set("next", "/");
  }

  const callbackRequest =
    url.toString() === request.url ? request : new NextRequest(url.toString(), request);

  return handleWayfinderAuthCallback(callbackRequest, {
    onAuthenticated: async ({ userId, email }) => {
      await seedReportRoles(userId, email);
    },
  });
}
