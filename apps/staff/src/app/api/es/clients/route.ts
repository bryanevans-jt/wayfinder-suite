import { createClientWithInvite, isEsRole } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithLoggedError,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

type Body = {
  name?: string;
  email?: string;
  serviceId?: string;
  officeId?: string;
  counselorId?: string;
};

export async function POST(request: Request) {
  const route = "api/es/clients";
  await assertNotPreviewMutation();

  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
  }

  if (!isEsRole(session.effectiveRole)) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const admin = createServiceRoleClient();

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = await createClientWithInvite(admin, {
      name: body.name ?? "",
      email: body.email ?? "",
      serviceId: body.serviceId ?? "",
      officeId: body.officeId ?? "",
      counselorId: body.counselorId ?? "",
      esUserId: session.effectiveUserId,
    });

    if ("error" in result) {
      const status = result.error.toLowerCase().includes("already") ? 409 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ ok: true, clientId: result.clientId });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
