import {
  assertClientProfileAccess,
  jsonClientProfileError,
} from "@/lib/client-profile-auth";
import { clientEmployerMatchSummary } from "@/lib/client-profile-matches";
import { geocodeUsAddress } from "@/lib/geocoding";
import { validateEmploymentCategoryFields } from "@wayfinder/branding";
import {
  ensureClientLoginForEmail,
  linkClientAuthUserByEmail,
  resolveAuthUserIdByEmail,
} from "@wayfinder/supabase";
import {
  respondWithLoggedError,
  USER_FACING_NOT_FOUND,
} from "@wayfinder/supabase/error-log";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

const PROFILE_SELECT =
  "id, contact_email, user_id, profile_id, home_address_line1, home_address_line2, home_city, home_state, home_zip, home_latitude, home_longitude, primary_phone, secondary_phone, employment_goal_primary, employment_goal_primary_other, employment_goal_secondary, employment_goal_secondary_other";

type ExistingClientRow = {
  id: string;
  user_id: string | null;
  profile_id: string | null;
  contact_email: string | null;
  full_name?: string | null;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const auth = await assertClientProfileAccess(id);
    const { data, error } = await auth.admin.from("clients").select(PROFILE_SELECT).eq("id", id).maybeSingle();

    if (error) {
      return respondWithLoggedError("staff", "api/clients/profile", error, {
        userId: auth.session.actorUserId,
        userRole: auth.role,
      });
    }
    if (!data) {
      return NextResponse.json({ error: USER_FACING_NOT_FOUND }, { status: 404 });
    }

    const { data: employers } = await auth.admin
      .from("employers")
      .select(
        "id, name, status, city, state, latitude, longitude, position_need_primary, position_need_primary_other, position_need_secondary, position_need_secondary_other"
      )
      .eq("status", "active");

    const matchSummary = clientEmployerMatchSummary(data, employers ?? []);

    return NextResponse.json({
      profile: data,
      readOnly: auth.readOnly,
      employerMatches: matchSummary.matches,
      missingGoals: matchSummary.missingGoals,
      missingGeocode: matchSummary.missingGeocode,
    });
  } catch (error) {
    return await jsonClientProfileError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const auth = await assertClientProfileAccess(id, true);
    const body = (await request.json()) as Record<string, unknown>;

    const primary = validateEmploymentCategoryFields(
      body.employment_goal_primary as string | undefined,
      body.employment_goal_primary_other as string | undefined,
      "Primary employment goal"
    );
    if (primary.error) {
      return NextResponse.json({ error: primary.error }, { status: 400 });
    }

    const secondary = validateEmploymentCategoryFields(
      body.employment_goal_secondary as string | undefined,
      body.employment_goal_secondary_other as string | undefined,
      "Secondary employment goal"
    );
    if (secondary.error) {
      return NextResponse.json({ error: secondary.error }, { status: 400 });
    }

    const contactEmailRaw =
      typeof body.contact_email === "string" ? body.contact_email.trim().toLowerCase() : "";
    if (contactEmailRaw && !contactEmailRaw.includes("@")) {
      return NextResponse.json(
        { error: "Enter a valid email, or leave it blank." },
        { status: 400 }
      );
    }
    const contactEmail = contactEmailRaw || null;

    const homeState =
      typeof body.home_state === "string" && body.home_state.trim()
        ? body.home_state.trim().toUpperCase()
        : null;
    if (homeState && homeState !== "GA" && homeState !== "TN") {
      return NextResponse.json({ error: "Home state must be GA or TN" }, { status: 400 });
    }

    const addressLine1 =
      typeof body.home_address_line1 === "string" ? body.home_address_line1.trim() : "";
    const city = typeof body.home_city === "string" ? body.home_city.trim() : "";
    const zip = typeof body.home_zip === "string" ? body.home_zip.trim() : "";

    let homeLatitude: number | null = null;
    let homeLongitude: number | null = null;

    if (addressLine1 && city && homeState && zip) {
      const geocoded = await geocodeUsAddress({
        addressLine1,
        addressLine2:
          typeof body.home_address_line2 === "string" ? body.home_address_line2 : null,
        city,
        state: homeState,
        zip,
      });
      if (geocoded) {
        homeLatitude = geocoded.latitude;
        homeLongitude = geocoded.longitude;
      }
    }

    const existing = await loadExistingClient(auth.admin, id);
    if ("error" in existing) {
      return respondWithLoggedError("staff", "api/clients/profile", existing.error, {
        userId: auth.session.actorUserId,
        userRole: auth.role,
      });
    }
    if (!existing.row) {
      return NextResponse.json({ error: USER_FACING_NOT_FOUND }, { status: 404 });
    }

    const patch: Record<string, string | number | null> = {
      contact_email: contactEmail,
      home_address_line1: addressLine1 || null,
      home_address_line2:
        typeof body.home_address_line2 === "string"
          ? body.home_address_line2.trim() || null
          : null,
      home_city: city || null,
      home_state: homeState,
      home_zip: zip || null,
      home_latitude: homeLatitude,
      home_longitude: homeLongitude,
      primary_phone:
        typeof body.primary_phone === "string" ? body.primary_phone.trim() || null : null,
      secondary_phone:
        typeof body.secondary_phone === "string" ? body.secondary_phone.trim() || null : null,
      employment_goal_primary: primary.category,
      employment_goal_primary_other: primary.otherText,
      employment_goal_secondary: secondary.category,
      employment_goal_secondary_other: secondary.otherText,
    };

    const { error } = await auth.admin.from("clients").update(patch).eq("id", id);
    if (error) {
      return respondWithLoggedError("staff", "api/clients/profile", error, {
        userId: auth.session.actorUserId,
        userRole: auth.role,
      });
    }

    let authUserId =
      (existing.row.user_id ?? existing.row.profile_id) as string | null;
    const previousEmail = (existing.row.contact_email ?? "").trim().toLowerCase();

    // No login yet: adding an email creates/links auth while keeping all casework on this client row.
    if (!authUserId && contactEmail) {
      const resolvedUserId = await resolveAuthUserIdByEmail(auth.admin, contactEmail);
      if (resolvedUserId) {
        await linkClientAuthUserByEmail(auth.admin, resolvedUserId, contactEmail);
        authUserId = resolvedUserId;
      } else {
        const displayName = await resolveClientDisplayName(auth.admin, existing.row);
        const provisioned = await ensureClientLoginForEmail(
          auth.admin,
          contactEmail,
          displayName,
          { sendInvite: false }
        );
        if ("error" in provisioned) {
          return NextResponse.json({ error: provisioned.error }, { status: 400 });
        }
        const { error: linkErr } = await auth.admin
          .from("clients")
          .update({
            user_id: provisioned.userId,
            profile_id: provisioned.userId,
          })
          .eq("id", id);
        if (linkErr) {
          return respondWithLoggedError("staff", "api/clients/profile", linkErr, {
            userId: auth.session.actorUserId,
            userRole: auth.role,
          });
        }
        authUserId = provisioned.userId;
      }
    } else if (authUserId && contactEmail && contactEmail !== previousEmail) {
      const { error: authErr } = await auth.admin.auth.admin.updateUserById(authUserId, {
        email: contactEmail,
      });
      if (authErr) {
        return respondWithLoggedError("staff", "api/clients/profile", authErr, {
          userId: auth.session.actorUserId,
          userRole: auth.role,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      geocoded: homeLatitude != null && homeLongitude != null,
    });
  } catch (error) {
    return await jsonClientProfileError(error);
  }
}

async function loadExistingClient(
  admin: Awaited<ReturnType<typeof assertClientProfileAccess>>["admin"],
  id: string
): Promise<{ row: ExistingClientRow | null } | { error: { message: string } }> {
  const withName = await admin
    .from("clients")
    .select("id, user_id, profile_id, contact_email, full_name")
    .eq("id", id)
    .maybeSingle();

  if (!withName.error) {
    return { row: (withName.data as ExistingClientRow | null) ?? null };
  }

  if (!/does not exist|Could not find the '|schema cache/i.test(withName.error.message)) {
    return { error: withName.error };
  }

  const fallback = await admin
    .from("clients")
    .select("id, user_id, profile_id, contact_email")
    .eq("id", id)
    .maybeSingle();

  if (fallback.error) {
    return { error: fallback.error };
  }

  return {
    row: fallback.data
      ? ({ ...(fallback.data as ExistingClientRow), full_name: null } as ExistingClientRow)
      : null,
  };
}

async function resolveClientDisplayName(
  admin: Awaited<ReturnType<typeof assertClientProfileAccess>>["admin"],
  existing: ExistingClientRow
): Promise<string> {
  const rosterName = existing.full_name?.trim();
  if (rosterName) {
    return rosterName;
  }

  const profileId = existing.user_id ?? existing.profile_id;
  if (profileId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", profileId)
      .maybeSingle();
    const profileName = (profile?.full_name as string | null)?.trim();
    if (profileName) {
      return profileName;
    }
  }

  return "Client";
}
