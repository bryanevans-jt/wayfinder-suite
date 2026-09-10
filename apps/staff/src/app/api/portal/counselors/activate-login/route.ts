import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import { bulkActivateCounselorLoginsForOffice } from "@/lib/portal-staff-users";
import { NextRequest } from "next/server";

type Body = {
  office_id?: string;
  /** When true, Supabase sends invite emails. Default false (silent login). */
  send_invite?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const { admin } = await assertPortalMutation("admin");
    const body = (await request.json()) as Body;
    const officeId = body.office_id?.trim();

    if (!officeId) {
      return Response.json({ error: "office_id is required" }, { status: 400 });
    }

    const sendInvite = body.send_invite === true;
    const result = await bulkActivateCounselorLoginsForOffice(admin, officeId, {
      sendInvite,
    });

    return Response.json({
      ok: true,
      activated: result.activated,
      reactivated: result.reactivated,
      skipped: result.skipped,
      results: result.results,
    });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
