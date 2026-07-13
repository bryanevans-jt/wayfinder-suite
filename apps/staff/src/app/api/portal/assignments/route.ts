import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import {
  clientInSupervisorScope,
  esUserAllowedForSupervisor,
  loadSupervisorScope,
  type SupervisorScope,
} from "@/lib/supervisor-client-scope";
import { isAdminTierRole } from "@wayfinder/supabase/roles";
import { NextRequest } from "next/server";

type AssignmentBody = {
  type?: string;
  counselor_id?: string;
  office_id?: string;
  user_id?: string;
  supervisor_user_id?: string;
  es_user_id?: string;
  client_id?: string;
  id?: string;
};

async function supervisorScopeForSession(
  admin: Awaited<ReturnType<typeof assertPortalMutation>>["admin"],
  role: string,
  userId: string
): Promise<SupervisorScope | null> {
  if (isAdminTierRole(role)) {
    return null;
  }
  return loadSupervisorScope(admin, userId);
}

async function assertSupervisedEsTarget(
  admin: Awaited<ReturnType<typeof assertPortalMutation>>["admin"],
  esUserId: string
): Promise<string | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", esUserId)
    .maybeSingle();

  if (!profile) {
    return "That Employment Specialist account was not found.";
  }
  if (profile.role !== "es") {
    return "Caseload can only be assigned to an Employment Specialist.";
  }
  if (profile.is_active === false) {
    return "That Employment Specialist account is inactive.";
  }
  return null;
}

async function assertEsClientMutationAllowed(
  admin: Awaited<ReturnType<typeof assertPortalMutation>>["admin"],
  scope: SupervisorScope | null,
  esUserId: string,
  clientId: string
): Promise<Response | null> {
  if (!scope) {
    return null;
  }

  if (!(await clientInSupervisorScope(admin, scope, clientId))) {
    return Response.json({ error: "Client not found in your supervisor scope." }, { status: 403 });
  }

  if (!esUserAllowedForSupervisor(scope, esUserId)) {
    return Response.json(
      { error: "That Employment Specialist is outside your supervisor scope." },
      { status: 403 }
    );
  }

  const esErr = await assertSupervisedEsTarget(admin, esUserId);
  if (esErr) {
    return Response.json({ error: esErr }, { status: 400 });
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { admin, user, role } = await assertPortalMutation("supervisor");
    const body = (await request.json()) as AssignmentBody;
    const type = body.type?.trim();
    const scope = await supervisorScopeForSession(admin, role, user.id);

    if (type !== "es_client" && !isAdminTierRole(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (type === "counselor_office") {
      if (!body.counselor_id || !body.office_id) {
        return Response.json({ error: "counselor_id and office_id required" }, { status: 400 });
      }
      const { data, error } = await admin
        .from("counselor_office_assignments")
        .insert({ counselor_id: body.counselor_id, office_id: body.office_id })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await admin
        .from("counselors")
        .update({ office_id: body.office_id })
        .eq("id", body.counselor_id);
      return Response.json({ id: data?.id });
    }

    if (type === "staff_office") {
      if (!body.user_id || !body.office_id) {
        return Response.json({ error: "user_id and office_id required" }, { status: 400 });
      }
      const { data, error } = await admin
        .from("staff_office_assignments")
        .insert({ user_id: body.user_id, office_id: body.office_id })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return Response.json({ id: data?.id });
    }

    if (type === "supervisor_es") {
      if (!body.supervisor_user_id || !body.es_user_id) {
        return Response.json(
          { error: "supervisor_user_id and es_user_id required" },
          { status: 400 }
        );
      }
      const { data, error } = await admin
        .from("supervisor_es_assignments")
        .insert({
          supervisor_user_id: body.supervisor_user_id,
          es_user_id: body.es_user_id,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return Response.json({ id: data?.id });
    }

    if (type === "es_client") {
      if (!body.es_user_id || !body.client_id) {
        return Response.json({ error: "es_user_id and client_id required" }, { status: 400 });
      }

      const denied = await assertEsClientMutationAllowed(
        admin,
        scope,
        body.es_user_id,
        body.client_id
      );
      if (denied) {
        return denied;
      }

      const { error: clearErr } = await admin
        .from("es_client_assignments")
        .delete()
        .eq("client_id", body.client_id);
      if (clearErr) throw new Error(clearErr.message);

      const { data, error } = await admin
        .from("es_client_assignments")
        .insert({ es_user_id: body.es_user_id, client_id: body.client_id })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return Response.json({ id: data?.id });
    }

    return Response.json({ error: "Unknown assignment type" }, { status: 400 });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { admin, user, role } = await assertPortalMutation("supervisor");
    const type = request.nextUrl.searchParams.get("type")?.trim();
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!type || !id) {
      return Response.json({ error: "type and id required" }, { status: 400 });
    }

    const scope = await supervisorScopeForSession(admin, role, user.id);

    if (type === "es_client") {
      const { data: link, error: loadErr } = await admin
        .from("es_client_assignments")
        .select("id, es_user_id, client_id")
        .eq("id", id)
        .maybeSingle();

      if (loadErr) throw new Error(loadErr.message);
      if (!link) {
        return Response.json({ error: "Assignment not found" }, { status: 404 });
      }

      const denied = await assertEsClientMutationAllowed(
        admin,
        scope,
        link.es_user_id as string,
        link.client_id as string
      );
      if (denied) {
        return denied;
      }

      const { error } = await admin.from("es_client_assignments").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return Response.json({ ok: true });
    }

    if (!isAdminTierRole(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const table =
      type === "counselor_office"
        ? "counselor_office_assignments"
        : type === "staff_office"
          ? "staff_office_assignments"
          : type === "supervisor_es"
            ? "supervisor_es_assignments"
            : null;

    if (!table) {
      return Response.json({ error: "Unknown assignment type" }, { status: 400 });
    }

    const { error } = await admin.from(table).delete().eq("id", id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
