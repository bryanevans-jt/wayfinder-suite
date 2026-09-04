import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import {
  canManageTeamDirectory,
  directoryPositionLabel,
  isStaffRole,
  isAdminRole,
  isSuperAdminRole,
} from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  job_title: string | null;
  birthday: string | null;
  work_start_date: string | null;
  home_city: string | null;
  is_active: boolean | null;
};

function mmDd(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  return `${m[2]}/${m[3]}`;
}

export async function GET() {
  const session = await getAppSession();
  if (!session || !isStaffRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, full_name, first_name, last_name, role, job_title, birthday, work_start_date, home_city, is_active"
    )
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const canEdit = canManageTeamDirectory(session.effectiveRole);
  const members = ((data ?? []) as ProfileRow[])
    .filter((p) => isStaffRole(p.role))
    .map((p) => ({
      id: p.id,
      full_name: (p.full_name ?? "").trim() || "Teammate",
      position: directoryPositionLabel({ role: p.role, jobTitle: p.job_title }),
      role: p.role,
      job_title: p.job_title,
      city: (p.home_city ?? "").trim() || null,
      birthday_display: mmDd(p.birthday),
      birthday: canEdit ? p.birthday : undefined,
      work_start_date: canEdit ? p.work_start_date : undefined,
      work_anniversary_display: mmDd(p.work_start_date),
      can_edit_job_title: canEdit && (isAdminRole(p.role) || isSuperAdminRole(p.role)),
    }));

  return NextResponse.json({ members, can_manage: canEdit });
}

export async function PATCH(request: Request) {
  await assertNotPreviewMutation();
  const session = await getAppSession();
  if (!session || !canManageTeamDirectory(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    user_id?: string;
    birthday?: string | null;
    work_start_date?: string | null;
    job_title?: string | null;
  };

  const userId = body.user_id?.trim();
  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (!target || !isStaffRole(target.role)) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if ("birthday" in body) {
    patch.birthday = body.birthday?.trim() || null;
  }
  if ("work_start_date" in body) {
    patch.work_start_date = body.work_start_date?.trim() || null;
  }
  if ("job_title" in body) {
    if (!(isAdminRole(target.role) || isSuperAdminRole(target.role))) {
      return NextResponse.json(
        { error: "job_title is only editable for Admin / Super Admin profiles" },
        { status: 400 }
      );
    }
    patch.job_title = body.job_title?.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
