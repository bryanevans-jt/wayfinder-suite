import { assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
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

export async function POST(request: NextRequest) {
  try {
    const { admin } = await assertPortalSession("admin");
    const body = (await request.json()) as AssignmentBody;
    const type = body.type?.trim();

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
    const { admin } = await assertPortalSession("admin");
    const type = request.nextUrl.searchParams.get("type")?.trim();
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!type || !id) {
      return Response.json({ error: "type and id required" }, { status: 400 });
    }

    const table =
      type === "counselor_office"
        ? "counselor_office_assignments"
        : type === "staff_office"
          ? "staff_office_assignments"
          : type === "supervisor_es"
            ? "supervisor_es_assignments"
            : type === "es_client"
              ? "es_client_assignments"
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
