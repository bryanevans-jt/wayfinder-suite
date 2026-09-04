import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { createServerClient } from "@wayfinder/supabase";
import { isFieldSpecialistRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { requireStaffClientAccess } from "@/lib/app-session";
import { loadClientDisplayNameById } from "@/lib/client-display-names";
import { loadStaffNameById } from "@/lib/staff-names";
import {
  isVprServiceStage,
  resolveReportingState,
  submitVocationalProgressReport,
} from "@/lib/vpr-submit";
import {
  respondWithLoggedError,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_NOTES = 20_000;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const route = "api/clients/[id]/vpr";
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
  }

  const role = session.effectiveRole;
  if (!isFieldSpecialistRole(role) && !isSupervisorRole(role)) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  try {
    await assertNotPreviewMutation();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Read-only preview" },
      { status: 403 }
    );
  }

  const { id: clientId } = await context.params;
  const allowed = await requireStaffClientAccess(session, clientId);
  if (!allowed) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const actor = { userId: session.actorUserId, userRole: session.actorRole };

  try {
    const body = (await request.json()) as {
      date?: string;
      notes?: string;
      serviceStage?: string;
      esName?: string;
      billableHours?: string;
    };
    const date = (body.date ?? "").trim();
    const notes = (body.notes ?? "").trim();
    const serviceStage = (body.serviceStage ?? "").trim();
    const esNameOverride = (body.esName ?? "").trim();
    const billableHours = (body.billableHours ?? "").trim();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!notes) {
      return NextResponse.json({ error: "Notes are required" }, { status: 400 });
    }
    if (notes.length > MAX_NOTES) {
      return NextResponse.json({ error: "Notes are too long" }, { status: 400 });
    }
    if (!isVprServiceStage(serviceStage)) {
      return NextResponse.json({ error: "Select a valid service stage" }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const { data: client, error: clientErr } = await admin
      .from("clients")
      .select("id, office_id, home_state, referral_state")
      .eq("id", clientId)
      .maybeSingle();

    if (clientErr) {
      const fallback = await admin
        .from("clients")
        .select("id, office_id, home_state")
        .eq("id", clientId)
        .maybeSingle();
      if (fallback.error || !fallback.data) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      return await finishSubmit({
        admin,
        session,
        clientId,
        date,
        notes,
        serviceStage,
        esNameOverride,
        billableHours,
        officeId: fallback.data.office_id as string | null,
        homeState: fallback.data.home_state as string | null,
        referralState: null,
      });
    }

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return await finishSubmit({
      admin,
      session,
      clientId,
      date,
      notes,
      serviceStage,
      esNameOverride,
      billableHours,
      officeId: client.office_id as string | null,
      homeState: client.home_state as string | null,
      referralState: (client as { referral_state?: string | null }).referral_state ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Drive folders and templates")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.includes("Missing Google OAuth")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return respondWithLoggedError("staff", route, err, actor);
  }
}

async function finishSubmit(input: {
  admin: ReturnType<typeof createServiceRoleClient>;
  session: NonNullable<Awaited<ReturnType<typeof getAppSession>>>;
  clientId: string;
  date: string;
  notes: string;
  serviceStage: string;
  esNameOverride: string;
  billableHours: string;
  officeId: string | null;
  homeState: string | null;
  referralState: string | null;
}) {
  const names = await loadClientDisplayNameById(input.admin, [input.clientId]);
  const clientName = names.get(input.clientId) ?? "Client";

  let officeState: string | null = null;
  if (input.officeId) {
    const { data: office } = await input.admin
      .from("offices")
      .select("state")
      .eq("id", input.officeId)
      .maybeSingle();
    officeState = (office?.state as string | null) ?? null;
  }

  const reportingState = resolveReportingState(
    input.referralState,
    officeState,
    input.homeState
  );

  const esNames = await loadStaffNameById(
    input.admin,
    [input.session.effectiveUserId],
    "Employment Specialist"
  );
  const esName =
    input.esNameOverride ||
    esNames.get(input.session.effectiveUserId) ||
    "Employment Specialist";

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const submitterEmail = user?.email ?? "";
  if (!submitterEmail.endsWith("@thejoshuatree.org")) {
    return NextResponse.json({ error: "A Joshua Tree email is required to file reports." }, { status: 403 });
  }

  const result = await submitVocationalProgressReport(input.admin, {
    reportData: {
      Date: input.date,
      ClientName: clientName,
      ServiceStage: input.serviceStage,
      EmploymentSpecialistName: esName,
      Notes: input.notes,
      BillableHours: input.billableHours || "0.00",
    },
    wayfinderClientId: input.clientId,
    reportingState,
    submittedByUserId: input.session.actorUserId,
    submitterEmail,
  });

  return NextResponse.json({
    success: true,
    message: `Report for ${clientName} submitted successfully!`,
    driveFileId: result.driveFileId,
    driveFileName: result.driveFileName,
    driveUrl: result.driveUrl,
  });
}
