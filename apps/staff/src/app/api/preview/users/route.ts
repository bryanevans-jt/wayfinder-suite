import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { createClient } from "@wayfinder/supabase/server";
import {
  isSuperAdminRole,
  PREVIEWABLE_ROLES,
  roleDisplayName,
} from "@wayfinder/supabase/roles";
import { personDisplayName } from "@wayfinder/branding";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/preview/users";
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const actor = await resolveErrorActor(supabase, user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_active || !isSuperAdminRole(profile.role)) {
      return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
    }

    const url = new URL(request.url);
    const roleFilter = url.searchParams.get("role")?.trim().toLowerCase();

    if (!roleFilter || !PREVIEWABLE_ROLES.includes(roleFilter as (typeof PREVIEWABLE_ROLES)[number])) {
      return NextResponse.json({
        roles: PREVIEWABLE_ROLES.map((role) => ({
          id: role,
          label: roleDisplayName(role),
        })),
      });
    }

    const admin = createServiceRoleClient();
    const { data: rows, error } = await admin
      .from("profiles")
      .select("id, role, full_name, is_active")
      .eq("role", roleFilter)
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    }

    const users = await Promise.all(
      (rows ?? []).map(async (row) => {
        const { data: authUser } = await admin.auth.admin.getUserById(row.id as string);
        const email = authUser?.user?.email ?? null;
        const label = personDisplayName({
          full_name: row.full_name as string | null,
          id: row.id as string,
        });
        return {
          id: row.id as string,
          role: row.role as string,
          full_name: row.full_name as string | null,
          email,
          label: email ? `${label} (${email})` : label,
        };
      })
    );

    return NextResponse.json({
      role: roleFilter,
      roleLabel: roleDisplayName(roleFilter),
      users,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err);
  }
}
