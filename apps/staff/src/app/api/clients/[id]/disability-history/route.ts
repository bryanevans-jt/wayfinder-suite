import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import {
  canEditStaffOnlyDisabilityHistory,
  canViewStaffOnlyDisabilityHistory,
} from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_LENGTH = 8000;

export async function GET(_request: Request, context: RouteContext) {
  const route = "api/clients/[id]/disability-history";
  const session = await getAppSession();
  if (!session || !canViewStaffOnlyDisabilityHistory(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: clientId } = await context.params;
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("clients")
    .select("disability_history")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    return respondWithLoggedError("staff", route, error, {
      userId: session.effectiveUserId,
      userRole: session.effectiveRole,
    });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    disabilityHistory: (data.disability_history as string | null) ?? null,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const route = "api/clients/[id]/disability-history";
  const session = await getAppSession();
  if (!session || !canEditStaffOnlyDisabilityHistory(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const body = (await request.json()) as { disabilityHistory?: string | null };
  const text =
    typeof body.disabilityHistory === "string"
      ? body.disabilityHistory.trim()
      : body.disabilityHistory === null
        ? ""
        : undefined;

  if (text === undefined) {
    return NextResponse.json({ error: "disabilityHistory is required" }, { status: 400 });
  }
  if (text.length > MAX_LENGTH) {
    return NextResponse.json({ error: "Disability / history is too long" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: existing } = await admin.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await admin
    .from("clients")
    .update({ disability_history: text || null })
    .eq("id", clientId);

  if (error) {
    return respondWithLoggedError("staff", route, error, {
      userId: session.effectiveUserId,
      userRole: session.effectiveRole,
    });
  }

  return NextResponse.json({ ok: true, disabilityHistory: text || null });
}
