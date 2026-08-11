import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import { mergeCounselors } from "@wayfinder/supabase/counselor-dedupe";
import { NextRequest } from "next/server";

type Body = {
  keeperId?: string;
  sourceId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const { admin } = await assertPortalMutation("super_admin");
    const body = (await request.json()) as Body;
    const result = await mergeCounselors(admin, {
      keeperId: body.keeperId ?? "",
      sourceId: body.sourceId ?? "",
    });
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json(result);
  } catch (error) {
    return await jsonPortalError(error, "portal/counselors/merge");
  }
}
