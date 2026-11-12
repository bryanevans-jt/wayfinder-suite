import { WAYFINDER_RENDEZVOUS_URL } from "@wayfinder/branding";
import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { canEditOwnStaffProfile } from "@wayfinder/supabase/roles";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { loadFeatureToggles } from "@/lib/feature-toggles";

function buildPublicBookingUrl(slug: string): string {
  const raw =
    process.env.NEXT_PUBLIC_RENDEZVOUS_APP_URL?.trim() || WAYFINDER_RENDEZVOUS_URL;
  return `${raw.replace(/\/$/, "")}/book/${encodeURIComponent(slug)}`;
}

async function loadRendezvousBookingLink(
  admin: SupabaseClient,
  userId: string
): Promise<{ url: string; enabled: boolean } | null> {
  const toggles = await loadFeatureToggles(admin);
  if (!toggles.rendezvousEnabled) return null;

  const { data, error } = await admin
    .schema("rendezvous")
    .from("staff_schedules")
    .select("slug, enabled")
    .eq("staff_user_id", userId)
    .maybeSingle();

  if (error || !data?.slug) return null;

  return {
    url: buildPublicBookingUrl(String(data.slug)),
    enabled: data.enabled === true,
  };
}

const PROFILE_SELECT =
  "id, full_name, first_name, last_name, phone, home_city, bio, role";

const PROFILE_SELECT_FALLBACK = "id, full_name, role";

function composeFullName(first: string, last: string): string | null {
  const name = [first, last].filter((p) => p.trim().length > 0).join(" ").trim();
  return name || null;
}

function errorMessage(err: { message?: string } | null | undefined): string {
  return err?.message ?? "";
}

function isMissingColumnError(err: { message?: string } | null | undefined): boolean {
  return /column/i.test(errorMessage(err));
}

function mentionsUpdatedAt(err: { message?: string } | null | undefined): boolean {
  return errorMessage(err).includes("updated_at");
}

async function loadProfileRow(
  admin: SupabaseClient,
  userId: string
): Promise<{ profile: Record<string, unknown> | null; error: Error | null }> {
  const full = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (!full.error) {
    return { profile: full.data as Record<string, unknown> | null, error: null };
  }

  if (!full.error.message.includes("column")) {
    return { profile: null, error: full.error };
  }

  const fallback = await admin
    .from("profiles")
    .select(PROFILE_SELECT_FALLBACK)
    .eq("id", userId)
    .maybeSingle();

  if (fallback.error) {
    return { profile: null, error: fallback.error };
  }

  return {
    profile: {
      ...(fallback.data as Record<string, unknown>),
      first_name: null,
      last_name: null,
      phone: null,
      home_city: null,
      bio: null,
    },
    error: null,
  };
}

export async function GET() {
  const route = "api/profile";
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const actor = await resolveErrorActor(supabase, user.id);
    const admin = createServiceRoleClient();
    const { profile, error } = await loadProfileRow(admin, user.id);

    if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    }

    if (!profile || !canEditOwnStaffProfile(profile.role as string)) {
      return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
    }

    const rendezvousBooking = await loadRendezvousBookingLink(admin, user.id);

    return NextResponse.json({
      profile,
      email: user.email ?? null,
      rendezvousBookingUrl: rendezvousBooking?.url ?? null,
      rendezvousBookingEnabled: rendezvousBooking?.enabled ?? null,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err);
  }
}

export async function PATCH(request: Request) {
  const route = "api/profile";
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const actor = await resolveErrorActor(supabase, user.id);
    const admin = createServiceRoleClient();

    const { profile: existing, error: loadError } = await loadProfileRow(admin, user.id);

    if (loadError) {
      return respondWithLoggedError("staff", route, loadError, actor);
    }

    if (!existing || !canEditOwnStaffProfile(existing.role as string)) {
      return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
    }

    const body = (await request.json()) as {
      first_name?: string;
      last_name?: string;
      phone?: string;
      home_city?: string;
      bio?: string;
    };

    const first_name = (body.first_name ?? "").trim();
    const last_name = (body.last_name ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const home_city = (body.home_city ?? "").trim();
    const bio = (body.bio ?? "").trim();
    const full_name = composeFullName(first_name, last_name);

    const patchBase = {
      first_name: first_name || null,
      last_name: last_name || null,
      full_name,
      phone: phone || null,
      home_city: home_city || null,
      bio: bio || null,
    };

    const patchWithTimestamp = {
      ...patchBase,
      updated_at: new Date().toISOString(),
    };

    let profile: Record<string, unknown> | null = null;
    let { data: updated, error } = await admin
      .from("profiles")
      .update(patchWithTimestamp)
      .eq("id", user.id)
      .select(PROFILE_SELECT)
      .maybeSingle();

    if (error && mentionsUpdatedAt(error)) {
      ({ data: updated, error } = await admin
        .from("profiles")
        .update(patchBase)
        .eq("id", user.id)
        .select(PROFILE_SELECT)
        .maybeSingle());
    }

    if (error && isMissingColumnError(error)) {
      const basic = await admin
        .from("profiles")
        .update({ full_name })
        .eq("id", user.id)
        .select(PROFILE_SELECT_FALLBACK)
        .maybeSingle();

      if (basic.error) {
        return respondWithLoggedError("staff", route, basic.error, actor);
      }

      profile = {
        ...(basic.data as Record<string, unknown>),
        first_name: first_name || null,
        last_name: last_name || null,
        phone: null,
        home_city: null,
        bio: null,
      };
    } else if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    } else {
      profile = updated as Record<string, unknown> | null;
    }

    return NextResponse.json({ profile });
  } catch (err) {
    return respondWithLoggedError("staff", route, err);
  }
}
