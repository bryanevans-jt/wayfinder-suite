import { assertPortalMutation, assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import { recordContactLogEvent } from "@/lib/contact-log-events";
import { activityLogsToCsv, loadActivityLogs, loadContactLogChangeRows } from "@/lib/portal-data";
import {
  clientInSupervisorScope,
  loadSupervisorScope,
} from "@/lib/supervisor-client-scope";
import { isAdminTierRole, isSuperAdminRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { NextRequest } from "next/server";

async function loadExistingContactLog(
  admin: Awaited<ReturnType<typeof assertPortalSession>>["admin"],
  id: string
) {
  const { data, error } = await admin
    .from("contact_logs")
    .select("id, client_id, public_outcome, notes, logged_by, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function assertCanMutateContactLog(
  admin: Awaited<ReturnType<typeof assertPortalSession>>["admin"],
  userId: string,
  role: string,
  clientId: string
): Promise<Response | null> {
  if (isSuperAdminRole(role) || isAdminTierRole(role)) {
    return null;
  }
  if (isSupervisorRole(role)) {
    const scope = await loadSupervisorScope(admin, userId);
    const allowed = await clientInSupervisorScope(admin, scope, clientId);
    if (!allowed) {
      return Response.json({ error: "Contact log not in your supervisor scope." }, { status: 403 });
    }
    return null;
  }
  return Response.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(request: NextRequest) {
  try {
    const { admin, user, role } = await assertPortalSession("supervisor");
    const sp = request.nextUrl.searchParams;
    const format = sp.get("format") ?? "json";

    let scope: { officeIds?: string[]; esUserIds?: string[] } | undefined;
    if (role === "supervisor" && !isAdminTierRole(role)) {
      const supervisorScope = await loadSupervisorScope(admin, user.id);
      scope = {
        officeIds: supervisorScope.officeIds,
        esUserIds: supervisorScope.esUserIds,
      };
    }

    const [rows, changeRows] = await Promise.all([
      loadActivityLogs(
        admin,
        {
          esUserId: sp.get("es") ?? undefined,
          clientId: sp.get("client") ?? undefined,
          officeId: sp.get("office") ?? undefined,
          limit: Number(sp.get("limit") ?? "500"),
        },
        scope
      ),
      loadContactLogChangeRows(admin, scope, Number(sp.get("limit") ?? "500")),
    ]);

    const merged = [...rows, ...changeRows].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );

    if (format === "csv") {
      const csv = activityLogsToCsv(merged);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="wayfinder-activity.csv"',
        },
      });
    }

    return Response.json({ logs: merged });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin, user, role } = await assertPortalMutation("super_admin");
    const body = (await request.json()) as {
      id?: string;
      public_outcome?: string;
      notes?: string;
    };
    if (!body.id) {
      return Response.json({ error: "id required" }, { status: 400 });
    }

    const existing = await loadExistingContactLog(admin, body.id);
    if (!existing) {
      return Response.json({ error: "Contact log not found" }, { status: 404 });
    }

    const nextOutcome = body.public_outcome?.trim() || null;
    const nextNotes = body.notes?.trim() || null;

    const { error } = await admin
      .from("contact_logs")
      .update({
        public_outcome: nextOutcome,
        notes: nextNotes,
      })
      .eq("id", body.id);
    if (error) throw new Error(error.message);

    await recordContactLogEvent(admin, {
      contactLogId: body.id,
      clientId: existing.client_id as string,
      actorUserId: user.id,
      eventKind: "admin_edited",
      before: {
        public_outcome: existing.public_outcome as string | null,
        notes: existing.notes as string | null,
      },
      after: {
        public_outcome: nextOutcome,
        notes: nextNotes,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { admin, user, role } = await assertPortalMutation("supervisor");
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return Response.json({ error: "id required" }, { status: 400 });
    }

    const existing = await loadExistingContactLog(admin, id);
    if (!existing) {
      return Response.json({ error: "Contact log not found" }, { status: 404 });
    }

    const blocked = await assertCanMutateContactLog(
      admin,
      user.id,
      role,
      existing.client_id as string
    );
    if (blocked) return blocked;

    await recordContactLogEvent(admin, {
      contactLogId: id,
      clientId: existing.client_id as string,
      actorUserId: user.id,
      eventKind: "deleted",
      before: {
        public_outcome: existing.public_outcome as string | null,
        notes: existing.notes as string | null,
      },
      metadata: {
        logged_by: existing.logged_by,
        logged_at: existing.created_at,
      },
    });

    await admin
      .from("es_time_entries")
      .delete()
      .eq("linked_source_type", "contact_log")
      .eq("linked_source_id", id);

    const { error } = await admin.from("contact_logs").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
