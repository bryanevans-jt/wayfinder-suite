import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/pre-ets/staff-assignments";
  const auth = await requirePreEtsApi("supervise");
  if (isPreEtsApiError(auth)) return auth;

  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId");

  try {
    const admin = createServiceRoleClient();
    let query = admin
      .from("pre_ets_staff_school_assignments")
      .select(
        "id, school_id, user_id, assignment_role, created_at, pre_ets_schools(name), profiles(full_name, role)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (schoolId) query = query.eq("school_id", schoolId);

    const { data, error } = await query;
    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ assignments: data ?? [] });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}

export async function POST(request: Request) {
  const route = "api/pre-ets/staff-assignments";
  const auth = await requirePreEtsApi("supervise");
  if (isPreEtsApiError(auth)) return auth;

  try {
    const body = (await request.json()) as {
      schoolId: string;
      userId: string;
      assignmentRole?: "primary" | "co_instructor" | "supervisor";
    };

    if (!body.schoolId || !body.userId) {
      return NextResponse.json({ error: "schoolId and userId required" }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("pre_ets_staff_school_assignments")
      .upsert(
        {
          school_id: body.schoolId,
          user_id: body.userId,
          assignment_role: body.assignmentRole ?? "primary",
        },
        { onConflict: "school_id,user_id,assignment_role" }
      )
      .select("id")
      .single();

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ assignmentId: data.id });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}

export async function DELETE(request: Request) {
  const route = "api/pre-ets/staff-assignments";
  const auth = await requirePreEtsApi("supervise");
  if (isPreEtsApiError(auth)) return auth;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    const { error } = await admin.from("pre_ets_staff_school_assignments").delete().eq("id", id);
    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
