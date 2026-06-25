import { createServerClient } from "@wayfinder/supabase";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import {
  isAdminTierRole,
  isEsRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

const PROFILE_SELECT =
  "id, full_name, first_name, last_name, phone, home_city, bio, role";

function canEditOwnStaffProfile(role: string | null | undefined): boolean {
  return isEsRole(role) || isSupervisorRole(role) || isAdminTierRole(role);
}

function composeFullName(first: string, last: string): string | null {
  const name = [first, last].filter((p) => p.trim().length > 0).join(" ").trim();
  return name || null;
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

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    }

    if (!profile || !canEditOwnStaffProfile(profile.role as string)) {
      return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
    }

    return NextResponse.json({
      profile,
      email: user.email ?? null,
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

    const { data: existing, error: loadError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

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

    const { data: profile, error } = await supabase
      .from("profiles")
      .update({
        first_name: first_name || null,
        last_name: last_name || null,
        full_name,
        phone: phone || null,
        home_city: home_city || null,
        bio: bio || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select(PROFILE_SELECT)
      .maybeSingle();

    if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    }

    return NextResponse.json({ profile });
  } catch (err) {
    return respondWithLoggedError("staff", route, err);
  }
}
