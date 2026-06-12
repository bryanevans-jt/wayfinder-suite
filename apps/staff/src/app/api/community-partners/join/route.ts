import { COMMUNITY_PARTNERS_NETWORK_NAME } from "@/lib/employer-constants";
import { buildEmployerLocationPatch, buildEmployerPositionPatch } from "@/lib/employer-profile";
import { logEmployerStatusChange } from "@/lib/employer-status-log";
import { notifyStaffOfPublicEmployerSubmission } from "@/lib/employer-submission-notify";
import {
  honeypotTriggered,
  publicSubmissionRateLimited,
  validatePublicFormToken,
} from "@/lib/public-form-guard";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithLoggedError,
  USER_FACING_SYSTEM_ERROR,
} from "@wayfinder/supabase/error-log";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (honeypotTriggered(body.company_fax)) {
    return NextResponse.json({ ok: true, id: "received" });
  }

  const tokenError = validatePublicFormToken(body.issuedAt, body.token);
  if (tokenError) {
    return NextResponse.json({ error: tokenError }, { status: 400 });
  }

  const name = (body.name as string | undefined)?.trim();
  if (!name) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  const contactEmail = (body.contact_email as string | undefined)?.trim() ?? "";
  if (!contactEmail) {
    return NextResponse.json({ error: "Contact email is required" }, { status: 400 });
  }

  const state = (body.state as string | undefined)?.trim().toUpperCase();
  if (!state || (state !== "GA" && state !== "TN")) {
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

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (err) {
    return NextResponse.json({ error: USER_FACING_SYSTEM_ERROR }, { status: 503 });
  }

  if (await publicSubmissionRateLimited(admin, contactEmail)) {
    return NextResponse.json(
      { error: "Too many submissions from this email. Try again later." },
      { status: 429 }
    );
  }

  let locationPatch;
  try {
    locationPatch = await buildEmployerLocationPatch({
      address_line1: body.address_line1 as string | undefined,
      address_line2: body.address_line2 as string | null | undefined,
      city: body.city as string | undefined,
      state,
      zip: body.zip as string | undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "We couldn't verify that address. Please check it and try again." },
      { status: 400 }
    );
  }

  const { data: employer, error } = await admin
    .from("employers")
    .insert({
      name,
      status: "pending_review",
      industry: (body.industry as string | undefined)?.trim() || null,
      contact_name: (body.contact_name as string | undefined)?.trim() || null,
      contact_email: contactEmail,
      contact_phone: (body.contact_phone as string | undefined)?.trim() || null,
      website: (body.website as string | undefined)?.trim() || null,
      notes: (body.notes as string | undefined)?.trim() || null,
      submission_source: "public",
      created_by: null,
      ...locationPatch,
      ...positionPatch,
    })
    .select(
      "id, name, status, city, state, latitude, longitude, position_need_primary, position_need_primary_other, position_need_secondary, position_need_secondary_other"
    )
    .single();

  if (error) {
    if (error.message.includes("employers")) {
      return NextResponse.json(
        { error: `${COMMUNITY_PARTNERS_NETWORK_NAME} is not set up yet.` },
        { status: 503 }
      );
    }
    return respondWithLoggedError("staff", "api/community-partners/join", error);
  }

  await logEmployerStatusChange({
    employerId: employer.id,
    changedBy: null,
    oldStatus: null,
    newStatus: "pending_review",
  });

  try {
    await notifyStaffOfPublicEmployerSubmission({
      id: employer.id,
      name: employer.name,
      status: employer.status,
      city: employer.city,
      state: employer.state,
      latitude: employer.latitude,
      longitude: employer.longitude,
      position_need_primary: employer.position_need_primary,
      position_need_primary_other: employer.position_need_primary_other,
      position_need_secondary: employer.position_need_secondary,
      position_need_secondary_other: employer.position_need_secondary_other,
    });
  } catch (notifyErr) {
    console.error("employer submission notify failed:", notifyErr);
  }

  return NextResponse.json({ ok: true, id: employer.id });
}
