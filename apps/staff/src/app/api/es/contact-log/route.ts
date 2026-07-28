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
    startTime?: string;
    endTime?: string;
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
  } catch (err) {
    const failure = await finishActionFailure(
      "staff",
      route,
      err instanceof Error ? err : new Error("Missing SUPABASE_SERVICE_ROLE_KEY"),
      {},
      "We could not save this contact log right now. Please try again."
    );
    return NextResponse.json(failure, { status: 503 });
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
            startTime: body.time.startTime,
            endTime: body.time.endTime,
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

const CORRECTION_WINDOW_MS = 24 * 60 * 60 * 1000;

type PatchBody = {
  id?: string;
  clientId?: string;
  contactNotes?: string;
  internalNotes?: string;
};

/** ES/supervisor: correct own contact log notes within 24 hours of create. */
export async function PATCH(request: Request) {
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
  } catch (err) {
    const failure = await finishActionFailure(
      "staff",
      route,
      err instanceof Error ? err : new Error("Missing SUPABASE_SERVICE_ROLE_KEY"),
      {},
      "We could not update this contact log right now. Please try again."
    );
    return NextResponse.json(failure, { status: 503 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const logId = body.id?.trim();
  const clientId = body.clientId?.trim();
  const contactNotes = (body.contactNotes ?? "").trim();
  if (!logId || !clientId) {
    return NextResponse.json({ ok: false, error: "Log and client are required." }, { status: 400 });
  }
  if (!contactNotes) {
    return NextResponse.json({ ok: false, error: "Notes are required." }, { status: 400 });
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

  const { data: existing, error: loadErr } = await admin
    .from("contact_logs")
    .select("id, client_id, logged_by, created_at")
    .eq("id", logId)
    .maybeSingle();
  if (loadErr) {
    return NextResponse.json({ ok: false, error: loadErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Contact log not found." }, { status: 404 });
  }

  const logClientId = String(existing.client_id);
  if (logClientId !== clientId) {
    return NextResponse.json({ ok: false, error: "Contact log does not match client." }, { status: 400 });
  }

  if (String(existing.logged_by ?? "") !== session.effectiveUserId) {
    return NextResponse.json(
      { ok: false, error: "You can only correct contact logs you created." },
      { status: 403 }
    );
  }

  const createdAt = Date.parse(String(existing.created_at));
  if (Number.isNaN(createdAt) || Date.now() - createdAt > CORRECTION_WINDOW_MS) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This contact log can no longer be corrected (24-hour window). Ask a super admin if you need a change.",
      },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();
  const actor = await resolveErrorActor(supabase, session.effectiveUserId);

  try {
    const { error: updErr } = await admin
      .from("contact_logs")
      .update({
        public_outcome: contactNotes,
        notes: (body.internalNotes ?? "").trim() || null,
      })
      .eq("id", logId);
    if (updErr) throw new Error(updErr.message);

    revalidateClientPaths(clientId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const hint =
      err instanceof Error
        ? friendlyApplicationSaveError(err.message)
        : "We could not update this contact log.";
    const failure = await finishActionFailure("staff", route, err, actor, hint);
    return NextResponse.json(failure, { status: 500 });
  }
}
