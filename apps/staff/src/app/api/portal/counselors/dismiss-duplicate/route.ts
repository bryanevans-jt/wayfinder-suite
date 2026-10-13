import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import {
  dismissCounselorDuplicatePair,
  loadDismissedCounselorDuplicatePairKeys,
} from "@wayfinder/supabase/counselor-dedupe";
import { NextRequest } from "next/server";

type Body = {
  counselorIdA?: string;
  counselorIdB?: string;
};

export async function GET() {
  try {
    const { admin } = await assertPortalMutation("admin");
    const pairKeys = [...(await loadDismissedCounselorDuplicatePairKeys(admin))];
    return Response.json({ pairKeys });
  } catch (error) {
    return await jsonPortalError(error, "portal/counselors/dismiss-duplicate");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, user } = await assertPortalMutation("admin");
    const body = (await request.json()) as Body;
    const result = await dismissCounselorDuplicatePair(admin, {
      counselorIdA: body.counselorIdA ?? "",
      counselorIdB: body.counselorIdB ?? "",
      dismissedByUserId: user.id,
    });
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error, "portal/counselors/dismiss-duplicate");
  }
}
