import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  logSystemError,
  resolveErrorActor,
  userFacingSystemErrorWithCode,
} from "@wayfinder/supabase/error-log";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextRequest, NextResponse } from "next/server";

type Body = {
  app?: "staff" | "client";
  message?: string;
  digest?: string | null;
  stack?: string | null;
  route?: string;
};

export async function POST(request: NextRequest) {
  const route = "api/system-error/report";
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const app = body.app === "client" ? "client" : "staff";

  try {
    const session = await getAppSession();
    const supabase = await createServerClient();
    const actor = session
      ? await resolveErrorActor(supabase, session.actorUserId)
      : {};

    const synthetic = new Error(body.message ?? "Client error boundary");
    if (body.stack) {
      synthetic.stack = body.stack;
    }

    const admin = createServiceRoleClient();
    const errorCode = await logSystemError(
      admin,
      {
        app,
        route: body.route ?? "client-error-boundary",
        userId: actor.userId,
        userName: actor.userName,
        userRole: actor.userRole,
        userRoleLabel: actor.userRoleLabel,
        metadata: {
          digest: body.digest ?? null,
          client_reported: true,
        },
      },
      synthetic
    );

    return NextResponse.json({
      errorCode,
      message: userFacingSystemErrorWithCode(errorCode),
    });
  } catch (err) {
    console.error(`${route} failed:`, err);
    return NextResponse.json({ error: "Could not log error" }, { status: 500 });
  }
}
