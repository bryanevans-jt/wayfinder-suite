import { assertPortalMutation, assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import { activityLogsToCsv, loadActivityLogs } from "@/lib/portal-data";
import { isAdminTierRole } from "@wayfinder/supabase/roles";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { admin, user, role } = await assertPortalSession("supervisor");
    const sp = request.nextUrl.searchParams;
    const format = sp.get("format") ?? "json";

    let scope: { officeIds?: string[]; esUserIds?: string[] } | undefined;
    if (role === "supervisor" && !isAdminTierRole(role)) {
      const [{ data: offices }, { data: esLinks }] = await Promise.all([
        admin.from("staff_office_assignments").select("office_id").eq("user_id", user.id),
        admin
          .from("supervisor_es_assignments")
          .select("es_user_id")
          .eq("supervisor_user_id", user.id),
      ]);
      scope = {
        officeIds: (offices ?? []).map((o) => o.office_id as string),
        esUserIds: (esLinks ?? []).map((e) => e.es_user_id as string),
      };
    }

    const rows = await loadActivityLogs(
      admin,
      {
        esUserId: sp.get("es") ?? undefined,
        clientId: sp.get("client") ?? undefined,
        officeId: sp.get("office") ?? undefined,
        limit: Number(sp.get("limit") ?? "500"),
      },
      scope
    );

    if (format === "csv") {
      const csv = activityLogsToCsv(rows);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="wayfinder-activity.csv"',
        },
      });
    }

    return Response.json({ logs: rows });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin } = await assertPortalMutation("super_admin");
    const body = (await request.json()) as {
      id?: string;
      public_outcome?: string;
      notes?: string;
    };
    if (!body.id) {
      return Response.json({ error: "id required" }, { status: 400 });
    }
    const { error } = await admin
      .from("contact_logs")
      .update({
        public_outcome: body.public_outcome?.trim() || null,
        notes: body.notes?.trim() || null,
      })
      .eq("id", body.id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { admin } = await assertPortalMutation("super_admin");
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return Response.json({ error: "id required" }, { status: 400 });
    }
    const { error } = await admin.from("contact_logs").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
