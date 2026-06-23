import { saveClientContactLog } from "@/lib/save-client-contact-log";
import { clientInSupervisorScope, loadSupervisorScope } from "@/lib/supervisor-client-scope";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";
import { createServerClient, isEsRole, isSupervisorRole } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  finishActionFailure,
  friendlyApplicationSaveError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
  USER_FACING_SYSTEM_ERROR,
} from "@wayfinder/supabase/error-log";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type Body = {
  clientId?: string;
  contactNotes?: string;
  internalNotes?: string;
  time?: {
    activityTypeId?: string;
    durationMinutes?: number;
    serviceDate?: string;
  };
};

function revalidateClientPaths(clientId: string) {
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/counselor");
  revalidatePath(`/dashboard/counselor/clients/${clientId}`);
  revalidatePath("/dashboard/timesheet");
  revalidatePath("/dashboard/supervisor");
}

export async function POST(request: Request) {
  const route = "api/es/contact-log";

  try {
    await assertNotPreviewMutation();
  } catch (err) {
    const failure = await finishActionFailure(
      "staff",
      route,
      err,
      {},
      "Read-only preview — exit preview to make changes."
    );
    return NextResponse.json(failure, { status: 403 });
  }

  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
  }

  if (!isEsRole(session.effectiveRole) && !isSupervisorRole(session.effectiveRole)) {
    return NextResponse.json({ ok: false, error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    return NextResponse.json({ ok: false, error: USER_FACING_SYSTEM_ERROR }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const clientId = body.clientId?.trim();
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "Client is required." }, { status: 400 });
  }

  let allowed = false;
  if (isEsRole(session.effectiveRole)) {
    allowed = await esIsAssignedToClient(session.effectiveUserId, clientId);
  } else if (isSupervisorRole(session.effectiveRole)) {
    const scope = await loadSupervisorScope(admin, session.effectiveUserId);
    allowed = await clientInSupervisorScope(admin, scope, clientId);
  }

  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Client not assigned to you." },
      { status: 403 }
    );
  }

  const supabase = await createServerClient();
  const actor = await resolveErrorActor(supabase, session.effectiveUserId);

  try {
    const timeInput =
      body.time?.activityTypeId && (body.time.durationMinutes ?? 0) > 0
        ? {
            activityTypeId: body.time.activityTypeId,
            durationMinutes: Number(body.time.durationMinutes),
            serviceDate: body.time.serviceDate,
          }
        : undefined;

    const result = await saveClientContactLog(admin, session.effectiveUserId, {
      clientId,
      contactNotes: body.contactNotes ?? "",
      internalNotes: body.internalNotes ?? "",
      time: timeInput,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    revalidateClientPaths(clientId);
    return NextResponse.json(result);
  } catch (err) {
    const hint =
      err instanceof Error
        ? friendlyApplicationSaveError(err.message)
        : "We could not save this contact log.";
    const failure = await finishActionFailure("staff", route, err, actor, hint);
    return NextResponse.json(failure, { status: 500 });
  }
}
