import { assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import { createClientWithInvite, updateClientRecord } from "@wayfinder/supabase";
import { NextRequest } from "next/server";

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
};

type PatchBody = {
  id?: string;
  name?: string;
  contact_email?: string;
  office_id?: string;
  counselor_id?: string;
  es_user_id?: string | null;
  current_service_id?: string;
  current_stage_id?: string;
};

export async function POST(request: NextRequest) {
  try {
    const { admin } = await assertPortalSession("admin");
    const body = (await request.json()) as CreateBody;

    const result = await createClientWithInvite(admin, {
      name: body.name ?? "",
      email: body.email ?? "",
      serviceId: body.serviceId ?? "",
      officeId: body.officeId ?? "",
      counselorId: body.counselorId ?? "",
      esUserId: body.esUserId,
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
    const { admin } = await assertPortalSession("admin");
    const body = (await request.json()) as PatchBody;
    const id = body.id?.trim();
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const { data: existing, error: loadErr } = await admin
      .from("clients")
      .select("id, user_id, profile_id, office_id, counselor_id, current_service_id, current_stage_id")
      .eq("id", id)
      .maybeSingle();

    if (loadErr) throw new Error(loadErr.message);
    if (!existing) {
      return Response.json({ error: "Client not found" }, { status: 404 });
    }

    const authUserId =
      (existing.user_id as string | null) ?? (existing.profile_id as string | null) ?? null;

    const patch: Record<string, string | null> = {};
    if (body.contact_email !== undefined) {
      patch.contact_email = body.contact_email.trim().toLowerCase() || null;
    }
    if (body.office_id !== undefined) {
      const officeId = body.office_id.trim();
      if (!officeId) {
        return Response.json({ error: "office_id cannot be empty" }, { status: 400 });
      }
      patch.office_id = officeId;
    }

    const targetOfficeId = (patch.office_id ?? existing.office_id) as string | null;

    let counselorForUpdate: { rowId: string; loginId?: string | null } | undefined;

    if (body.counselor_id !== undefined) {
      const counselorId = body.counselor_id.trim();
      if (!counselorId) {
        return Response.json({ error: "counselor_id cannot be empty" }, { status: 400 });
      }
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
        return Response.json(
          { error: "Counselor must belong to the client's office" },
          { status: 400 }
        );
      }
      counselorForUpdate = {
        rowId: counselorId,
        loginId: counselor.user_id as string | null,
      };
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

    if (body.name !== undefined && authUserId) {
      const name = body.name.trim();
      if (!name) {
        return Response.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      const { error: profileErr } = await admin
        .from("profiles")
        .update({ full_name: name })
        .eq("id", authUserId);
      if (profileErr) throw new Error(profileErr.message);
    }

    if (body.es_user_id !== undefined) {
      const { error: clearErr } = await admin
        .from("es_client_assignments")
        .delete()
        .eq("client_id", id);
      if (clearErr) throw new Error(clearErr.message);

      if (body.es_user_id) {
        const esUserId = body.es_user_id.trim();
        const { error: assignErr } = await admin.from("es_client_assignments").insert({
          es_user_id: esUserId,
          client_id: id,
        });
        if (assignErr) throw new Error(assignErr.message);
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { admin } = await assertPortalSession("admin");
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    await admin.from("es_client_assignments").delete().eq("client_id", id);
    const { error } = await admin.from("clients").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
