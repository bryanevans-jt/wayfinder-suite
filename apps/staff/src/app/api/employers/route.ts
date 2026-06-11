import {
  assertCommunityPartnersMutation,
  assertCommunityPartnersSession,
} from "@/lib/community-partners-auth";
import { COMMUNITY_PARTNERS_NETWORK_NAME, isEmployerStatus } from "@/lib/employer-constants";
import { buildEmployerLocationPatch, buildEmployerPositionPatch } from "@/lib/employer-profile";
import { logEmployerStatusChange } from "@/lib/employer-status-log";
import {
  respondWithLoggedError,
  resolveErrorActor,
} from "@wayfinder/supabase/error-log";
import { NextRequest, NextResponse } from "next/server";

const EMPLOYER_LIST_SELECT =
  "id, name, status, industry, contact_name, contact_email, contact_phone, address_line1, city, state, zip, website, office_id, position_need_primary, position_need_primary_other, position_need_secondary, position_need_secondary_other, latitude, longitude, submission_source, created_at, updated_at, offices(name)";

function employerMatchesPositionFilter(
  row: Record<string, unknown>,
  position: string
): boolean {
  const key = position.trim().toLowerCase();
  const primary = (row.position_need_primary as string | null)?.toLowerCase();
  const secondary = (row.position_need_secondary as string | null)?.toLowerCase();
  return primary === key || secondary === key;
}

export async function GET(request: NextRequest) {
  const auth = await assertCommunityPartnersSession();
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const { supabase } = auth;
  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const status = request.nextUrl.searchParams.get("status")?.trim() ?? "";
  const city = request.nextUrl.searchParams.get("city")?.trim().toLowerCase() ?? "";
  const state = request.nextUrl.searchParams.get("state")?.trim().toUpperCase() ?? "";
  const position = request.nextUrl.searchParams.get("position")?.trim() ?? "";

  let query = supabase.from("employers").select(EMPLOYER_LIST_SELECT).order("name", {
    ascending: true,
  });

  if (status && isEmployerStatus(status)) {
    query = query.eq("status", status);
  }
  if (state && (state === "GA" || state === "TN")) {
    query = query.eq("state", state);
  }

  const { data, error } = await query;

  if (error) {
    if (error.message.includes("employers")) {
      return NextResponse.json(
        {
          error: `${COMMUNITY_PARTNERS_NETWORK_NAME} tables are not set up yet. Run migrations in Supabase.`,
        },
        { status: 503 }
      );
    }
    return respondWithLoggedError("staff", "api/employers", error, {
      userId: auth.effectiveUserId,
      userRole: auth.session.effectiveRole,
    });
  }

  let employers = (data ?? []) as Record<string, unknown>[];

  if (q) {
    employers = employers.filter((row) => {
      const haystack = [
        row.name,
        row.industry,
        row.contact_name,
        row.contact_email,
        row.city,
        row.address_line1,
        (row as { offices?: { name: string } | null }).offices?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  if (city) {
    employers = employers.filter((row) =>
      ((row.city as string | null) ?? "").toLowerCase().includes(city)
    );
  }

  if (position) {
    employers = employers.filter((row) => employerMatchesPositionFilter(row, position));
  }

  return NextResponse.json({
    employers,
    readOnly: auth.readOnly,
    canDelete: auth.canDelete,
    isAdminTier: auth.isAdminTier,
  });
}

export async function POST(request: NextRequest) {
  const auth = await assertCommunityPartnersMutation();
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const body = (await request.json()) as Record<string, unknown>;

  const name = (body.name as string | undefined)?.trim();
  if (!name) {
    return NextResponse.json({ error: "Employer name is required" }, { status: 400 });
  }

  const status = ((body.status as string | undefined) ?? "active").trim().toLowerCase();
  if (!isEmployerStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const state = (body.state as string | undefined)?.trim().toUpperCase();
  if (state && state !== "GA" && state !== "TN") {
    return NextResponse.json({ error: "State must be GA or TN" }, { status: 400 });
  }

  let positionPatch;
  try {
    positionPatch = buildEmployerPositionPatch(body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid position fields" },
      { status: 400 }
    );
  }

  const locationPatch = await buildEmployerLocationPatch({
    address_line1: body.address_line1 as string | undefined,
    address_line2: body.address_line2 as string | null | undefined,
    city: body.city as string | undefined,
    state,
    zip: body.zip as string | undefined,
  });

  const {
    data: { user },
  } = await auth.supabase.auth.getUser();

  const actorId = user?.id ?? auth.session.actorUserId;

  const { data: employer, error } = await auth.supabase
    .from("employers")
    .insert({
      name,
      status,
      industry: (body.industry as string | undefined)?.trim() || null,
      contact_name: (body.contact_name as string | undefined)?.trim() || null,
      contact_email: (body.contact_email as string | undefined)?.trim() || null,
      contact_phone: (body.contact_phone as string | undefined)?.trim() || null,
      website: (body.website as string | undefined)?.trim() || null,
      notes: (body.notes as string | undefined)?.trim() || null,
      office_id: (body.office_id as string | undefined)?.trim() || null,
      created_by: actorId,
      submission_source: "staff",
      ...locationPatch,
      ...positionPatch,
    })
    .select("id")
    .single();

  if (error) {
    const actor = await resolveErrorActor(auth.supabase, auth.session.actorUserId);
    return respondWithLoggedError("staff", "api/employers", error, actor);
  }

  await logEmployerStatusChange({
    employerId: employer.id,
    changedBy: actorId,
    oldStatus: null,
    newStatus: status,
  });

  return NextResponse.json({ ok: true, id: employer.id });
}
