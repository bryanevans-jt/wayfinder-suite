import {
  assertCommunityPartnersMutation,
  assertCommunityPartnersSession,
} from "@/lib/community-partners-auth";
import { isEmployerStatus } from "@/lib/employer-constants";
import { buildEmployerLocationPatch, buildEmployerPositionPatch } from "@/lib/employer-profile";
import { logEmployerStatusChange } from "@/lib/employer-status-log";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_FORBIDDEN,
  USER_FACING_NOT_FOUND,
} from "@wayfinder/supabase/error-log";
import { NextRequest, NextResponse } from "next/server";

const EMPLOYER_DETAIL_SELECT =
  "id, name, status, industry, contact_name, contact_email, contact_phone, address_line1, address_line2, city, state, zip, latitude, longitude, website, notes, office_id, position_need_primary, position_need_primary_other, position_need_secondary, position_need_secondary_other, submission_source, created_at, updated_at, offices(name)";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const route = "api/employers/[id]";
  const auth = await assertCommunityPartnersSession();
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const { id } = await context.params;
  const { data: employer, error } = await auth.supabase
    .from("employers")
    .select(EMPLOYER_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return respondWithLoggedError("staff", route, error, {
      userId: auth.effectiveUserId,
      userRole: auth.session.effectiveRole,
    });
  }

  if (!employer) {
    return NextResponse.json({ error: USER_FACING_NOT_FOUND }, { status: 404 });
  }

  return NextResponse.json({
    employer,
    readOnly: auth.readOnly,
    canDelete: auth.canDelete,
    isAdminTier: auth.isAdminTier,
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const route = "api/employers/[id]";
  const auth = await assertCommunityPartnersMutation();
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const { id } = await context.params;
  const { data: existing } = await auth.supabase
    .from("employers")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: USER_FACING_NOT_FOUND }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if ("name" in body) {
    const name = (body.name as string | undefined)?.trim();
    if (!name) {
      return NextResponse.json({ error: "Partner name is required" }, { status: 400 });
    }
    patch.name = name;
  }

  if ("status" in body) {
    const status = (body.status as string | undefined)?.trim().toLowerCase();
    if (!status || !isEmployerStatus(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = status;
  }

  const stringFields = [
    "industry",
    "contact_name",
    "contact_email",
    "contact_phone",
    "website",
    "notes",
  ] as const;
  for (const key of stringFields) {
    if (key in body) {
      patch[key] = (body[key] as string | undefined)?.trim() || null;
    }
  }

  if ("office_id" in body) {
    patch.office_id = (body.office_id as string | undefined)?.trim() || null;
  }

  const locationKeys = ["address_line1", "address_line2", "city", "state", "zip"] as const;
  if (locationKeys.some((k) => k in body)) {
    const state = (body.state as string | undefined)?.trim().toUpperCase();
    if (state && state !== "GA" && state !== "TN") {
      return NextResponse.json({ error: "State must be GA or TN" }, { status: 400 });
    }
    Object.assign(
      patch,
      await buildEmployerLocationPatch({
        address_line1: body.address_line1 as string | undefined,
        address_line2: body.address_line2 as string | null | undefined,
        city: body.city as string | undefined,
        state,
        zip: body.zip as string | undefined,
      })
    );
  }

  const positionKeys = [
    "position_need_primary",
    "position_need_primary_other",
    "position_need_secondary",
    "position_need_secondary_other",
  ] as const;
  if (positionKeys.some((k) => k in body)) {
    try {
      Object.assign(patch, buildEmployerPositionPatch(body));
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid position fields" },
        { status: 400 }
      );
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const { error } = await auth.supabase.from("employers").update(patch).eq("id", id);

  if (error) {
    const actor = await resolveErrorActor(auth.supabase, auth.session.actorUserId);
    return respondWithLoggedError("staff", route, error, actor);
  }

  if (typeof patch.status === "string" && patch.status !== existing.status) {
    const {
      data: { user },
    } = await auth.supabase.auth.getUser();
    await logEmployerStatusChange({
      employerId: id,
      changedBy: user?.id ?? auth.session.actorUserId,
      oldStatus: existing.status as string,
      newStatus: patch.status,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const route = "api/employers/[id]";
  const auth = await assertCommunityPartnersMutation();
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  if (!auth.canDelete) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const { id } = await context.params;
  const { error } = await auth.supabase.from("employers").delete().eq("id", id);

  if (error) {
    const actor = await resolveErrorActor(auth.supabase, auth.session.actorUserId);
    return respondWithLoggedError("staff", route, error, actor);
  }

  return NextResponse.json({ ok: true });
}
