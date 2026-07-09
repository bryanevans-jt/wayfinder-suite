import { assertPortalMutation, assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import {
  clientInSupervisorScope,
  esUserAllowedForSupervisor,
  esUserAllowedForSupervisorClient,
  loadSupervisorScope,
  officeAllowedForSupervisor,
  type SupervisorScope,
} from "@/lib/supervisor-client-scope";
import {
  createClientWithInvite,
  ensureClientLoginForEmail,
  linkClientAuthUserByEmail,
  resolveAuthUserIdByEmail,
  updateClientRecord,
} from "@wayfinder/supabase";
import { isAdminTierRole } from "@wayfinder/supabase/roles";
import { isCaseloadAssigneeRole } from "@/lib/caseload-assignee";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function counselorBelongsToOffice(
  admin: Awaited<ReturnType<typeof assertPortalSession>>["admin"],
  counselorId: string,
  officeId: string
): Promise<boolean> {
  const { data: counselor } = await admin
    .from("counselors")
    .select("id, office_id")
    .eq("id", counselorId)
    .maybeSingle();

  if (!counselor) return false;
  if (counselor.office_id === officeId) return true;

  const { data: link } = await admin
    .from("counselor_office_assignments")
    .select("id")
    .eq("counselor_id", counselorId)
    .eq("office_id", officeId)
    .maybeSingle();

  return Boolean(link);
}

type CreateBody = {
  name?: string;
  email?: string;
  serviceId?: string;
  officeId?: string;
  counselorId?: string;
  esUserId?: string;
  esEmail?: string;
};

type PatchBody = {
  id?: string;
  name?: string;
  contact_email?: string;
  office_id?: string;
  counselor_id?: string;
  es_user_id?: string | null;
  es_email?: string | null;
  current_service_id?: string;
  current_stage_id?: string;
};

async function supervisorScopeForSession(
  admin: Awaited<ReturnType<typeof assertPortalSession>>["admin"],
  role: string,
  userId: string
): Promise<SupervisorScope | null> {
  if (isAdminTierRole(role)) {
    return null;
  }
  return loadSupervisorScope(admin, userId);
}

async function resolveEsUserId(
  admin: Awaited<ReturnType<typeof assertPortalSession>>["admin"],
  scope: SupervisorScope | null,
  esUserId?: string,
  esEmail?: string,
  clientId?: string
): Promise<{ esUserId?: string; error?: string }> {
  async function validateCaseloadAssignee(userId: string): Promise<string | null> {
    const { data: profile } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) {
      return "That Employment Specialist account was not found.";
    }
    if (!isCaseloadAssigneeRole(profile.role as string)) {
      return "Caseload can only be assigned to an Employment Specialist or supervisor.";
    }
    return null;
  }

  if (esEmail?.trim()) {
    const resolved = await resolveAuthUserIdByEmail(admin, esEmail.trim());
    if (!resolved) {
      return { error: "No Wayfinder account found for that Employment Specialist email." };
    }
    const assigneeErr = await validateCaseloadAssignee(resolved);
    if (assigneeErr) {
      return { error: assigneeErr };
    }
    if (scope) {
      const allowed = clientId
        ? await esUserAllowedForSupervisorClient(admin, scope, resolved, clientId)
        : esUserAllowedForSupervisor(scope, resolved);
      if (!allowed) {
        return { error: "That Employment Specialist is outside your supervisor scope." };
      }
    }
    return { esUserId: resolved };
  }

  if (esUserId?.trim()) {
    const id = esUserId.trim();
    const assigneeErr = await validateCaseloadAssignee(id);
    if (assigneeErr) {
      return { error: assigneeErr };
    }
    if (scope) {
      const allowed = clientId
        ? await esUserAllowedForSupervisorClient(admin, scope, id, clientId)
        : esUserAllowedForSupervisor(scope, id);
      if (!allowed) {
        return { error: "That Employment Specialist is outside your supervisor scope." };
      }
    }
    return { esUserId: id };
  }

  return {};
}

export async function POST(request: NextRequest) {
  try {
    const { admin, user, role } = await assertPortalMutation("supervisor");
    const body = (await request.json()) as CreateBody;
    const scope = await supervisorScopeForSession(admin, role, user.id);

    const officeId = body.officeId?.trim() ?? "";
    if (scope && officeId && !officeAllowedForSupervisor(scope, officeId)) {
      return Response.json({ error: "That office is outside your supervisor scope." }, { status: 403 });
    }

    const esResolved = await resolveEsUserId(admin, scope, body.esUserId, body.esEmail);
    if (esResolved.error) {
      return Response.json({ error: esResolved.error }, { status: 400 });
    }

    const result = await createClientWithInvite(admin, {
      name: body.name ?? "",
      email: body.email ?? "",
      serviceId: body.serviceId ?? "",
      officeId,
      counselorId: body.counselorId ?? "",
      esUserId: esResolved.esUserId,
    });

    if ("error" in result) {
      const status = result.error.toLowerCase().includes("already") ? 409 : 400;
      return Response.json({ error: result.error }, { status });
    }

    return Response.json({ ok: true, clientId: result.clientId });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin, user, role } = await assertPortalMutation("supervisor");
    const body = (await request.json()) as PatchBody;
    const id = body.id?.trim();
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const scope = await supervisorScopeForSession(admin, role, user.id);
    if (scope && !(await clientInSupervisorScope(admin, scope, id))) {
      return Response.json({ error: "Client not found in your supervisor scope." }, { status: 403 });
    }

    const { data: existing, error: loadErr } = await admin
      .from("clients")
      .select(
        "id, user_id, profile_id, full_name, contact_email, office_id, counselor_id, current_service_id, current_stage_id"
      )
      .eq("id", id)
      .maybeSingle();

    if (loadErr) throw new Error(loadErr.message);
    if (!existing) {
      return Response.json({ error: "Client not found" }, { status: 404 });
    }

    const authUserId =
      (existing.user_id as string | null) ?? (existing.profile_id as string | null) ?? null;

    const patch: Record<string, string | null> = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        return Response.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      if (authUserId) {
        // Profile name is synced after other updates when a login exists.
      } else {
        patch.full_name = name;
      }
    }
    if (body.contact_email !== undefined) {
      patch.contact_email = body.contact_email.trim().toLowerCase() || null;
    }
    if (body.office_id !== undefined) {
      const officeId = body.office_id.trim();
      if (!officeId) {
        return Response.json({ error: "office_id cannot be empty" }, { status: 400 });
      }
      if (scope && !officeAllowedForSupervisor(scope, officeId)) {
        return Response.json({ error: "That office is outside your supervisor scope." }, { status: 403 });
      }
      patch.office_id = officeId;
    }

    const targetOfficeId = (patch.office_id ?? existing.office_id) as string | null;

    let counselorForUpdate: { rowId: string; loginId?: string | null } | null | undefined;

    if (body.counselor_id !== undefined) {
      const counselorId = body.counselor_id.trim();
      if (!counselorId) {
        // Allow unassigning counselor (roster / migration clients often have none).
        counselorForUpdate = null;
      } else {
        const { data: counselor, error: counselorErr } = await admin
          .from("counselors")
          .select("id, office_id, user_id")
          .eq("id", counselorId)
          .maybeSingle();

        if (counselorErr || !counselor) {
          return Response.json({ error: "Invalid counselor" }, { status: 400 });
        }
        if (
          targetOfficeId &&
          !(await counselorBelongsToOffice(admin, counselorId, targetOfficeId))
        ) {
          // Imported counselors may only sit on a staging office — link them to the
          // client's office so staff can keep the assignment when updating office.
          const { error: linkErr } = await admin.from("counselor_office_assignments").upsert(
            { counselor_id: counselorId, office_id: targetOfficeId },
            { onConflict: "counselor_id,office_id" }
          );
          if (linkErr) {
            return Response.json(
              { error: "Counselor must belong to the client's office" },
              { status: 400 }
            );
          }
        }
        counselorForUpdate = {
          rowId: counselorId,
          loginId: counselor.user_id as string | null,
        };
      }
    }

    const targetServiceId =
      body.current_service_id !== undefined
        ? body.current_service_id.trim()
        : ((existing.current_service_id as string | null) ?? null);

    if (body.current_service_id !== undefined) {
      if (!targetServiceId) {
        return Response.json({ error: "current_service_id cannot be empty" }, { status: 400 });
      }
      const { data: service, error: serviceErr } = await admin
        .from("services")
        .select("id")
        .eq("id", targetServiceId)
        .maybeSingle();
      if (serviceErr || !service) {
        return Response.json({ error: "Invalid service" }, { status: 400 });
      }
      patch.current_service_id = targetServiceId;
    }

    if (body.current_stage_id !== undefined || body.current_service_id !== undefined) {
      let stageId =
        body.current_stage_id !== undefined ? body.current_stage_id.trim() : "";

      if (!stageId && body.current_service_id !== undefined && targetServiceId) {
        const { data: firstMilestone, error: msErr } = await admin
          .from("service_milestones")
          .select("id")
          .eq("service_id", targetServiceId)
          .order("order_index", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (msErr || !firstMilestone) {
          return Response.json(
            {
              error:
                "This service has no milestones yet. Add milestones before changing service.",
            },
            { status: 400 }
          );
        }
        stageId = firstMilestone.id as string;
      }

      if (!stageId) {
        return Response.json({ error: "current_stage_id cannot be empty" }, { status: 400 });
      }

      if (!targetServiceId) {
        return Response.json({ error: "Assign a service before setting a stage" }, { status: 400 });
      }

      const { data: milestone, error: milestoneErr } = await admin
        .from("service_milestones")
        .select("id, service_id")
        .eq("id", stageId)
        .maybeSingle();

      if (milestoneErr || !milestone) {
        return Response.json({ error: "Invalid stage for this service" }, { status: 400 });
      }
      if ((milestone.service_id as string) !== targetServiceId) {
        return Response.json(
          { error: "Stage must belong to the selected service" },
          { status: 400 }
        );
      }
      patch.current_stage_id = stageId;
    }

    if (Object.keys(patch).length > 0 || counselorForUpdate) {
      const result = await updateClientRecord(
        admin,
        id,
        patch,
        counselorForUpdate
      );
      if ("error" in result) throw new Error(result.error);
    }

    let linkedAuthUserId = authUserId;
    const emailForLink =
      patch.contact_email !== undefined
        ? patch.contact_email
        : (existing.contact_email as string | null);

    if (!linkedAuthUserId && emailForLink) {
      const resolvedUserId = await resolveAuthUserIdByEmail(admin, emailForLink);
      if (resolvedUserId) {
        await linkClientAuthUserByEmail(admin, resolvedUserId, emailForLink);
        linkedAuthUserId = resolvedUserId;
      } else if (patch.contact_email) {
        const displayName =
          body.name?.trim() ||
          (existing.full_name as string | null)?.trim() ||
          "Client";
        const provisioned = await ensureClientLoginForEmail(admin, emailForLink, displayName, {
          sendInvite: false,
        });
        if ("error" in provisioned) {
          return Response.json({ error: provisioned.error }, { status: 400 });
        }
        const { error: linkErr } = await admin
          .from("clients")
          .update({
            user_id: provisioned.userId,
            profile_id: provisioned.userId,
          })
          .eq("id", id);
        if (linkErr) {
          throw new Error(linkErr.message);
        }
        linkedAuthUserId = provisioned.userId;
      }
    }

    if (body.name !== undefined && linkedAuthUserId) {
      const name = body.name.trim();
      const { error: profileErr } = await admin
        .from("profiles")
        .update({ full_name: name })
        .eq("id", linkedAuthUserId);
      if (profileErr) throw new Error(profileErr.message);
    }

    if (body.es_user_id !== undefined || body.es_email !== undefined) {
      const trimmedEmail = body.es_email?.trim() ?? "";
      const targetEsId = trimmedEmail ? null : body.es_user_id?.trim() || null;

      const { data: currentLinks } = await admin
        .from("es_client_assignments")
        .select("es_user_id")
        .eq("client_id", id);
      const currentEsId = (currentLinks?.[0]?.es_user_id as string | undefined) ?? null;

      if (!trimmedEmail && targetEsId === currentEsId) {
        // ES assignment unchanged — skip replace.
      } else {
        const esResolved = await resolveEsUserId(
          admin,
          scope,
          targetEsId ?? undefined,
          trimmedEmail || undefined,
          id
        );
        if (esResolved.error) {
          return Response.json({ error: esResolved.error }, { status: 400 });
        }

        const { error: clearErr } = await admin
          .from("es_client_assignments")
          .delete()
          .eq("client_id", id);
        if (clearErr) throw new Error(clearErr.message);

        if (esResolved.esUserId) {
          const { error: assignErr } = await admin.from("es_client_assignments").insert({
            es_user_id: esResolved.esUserId,
            client_id: id,
          });
          if (assignErr) throw new Error(assignErr.message);
        }
      }
    }

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
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const scope = await supervisorScopeForSession(admin, role, user.id);
    if (scope && !(await clientInSupervisorScope(admin, scope, id))) {
      return Response.json({ error: "Client not found in your supervisor scope." }, { status: 403 });
    }

    await admin.from("es_client_assignments").delete().eq("client_id", id);
    const { error } = await admin.from("clients").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
