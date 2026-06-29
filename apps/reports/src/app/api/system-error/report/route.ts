import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  logSystemError,
  resolveErrorActor,
  userFacingSystemErrorWithCode,
} from "@wayfinder/supabase/error-log";
import { NextRequest, NextResponse } from "next/server";

type Body = {
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

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const actor = user ? await resolveErrorActor(supabase, user.id) : {};

    const synthetic = new Error(body.message ?? "Client error boundary");
    if (body.stack) {
      synthetic.stack = body.stack;
    }

    const admin = createServiceRoleClient();
    const errorCode = await logSystemError(
      admin,
      {
        app: "reports",
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
