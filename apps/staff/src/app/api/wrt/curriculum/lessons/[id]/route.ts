import { jsonWrtError, requireWrtCurriculumSession, wrtOk } from "@/lib/staff-wrt-auth";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const route = "api/wrt/curriculum/lessons/[id]";
  try {
    const { id } = await context.params;
    const { admin } = await requireWrtCurriculumSession(true);
    const body = (await request.json()) as Record<string, unknown>;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      "title",
      "slug",
      "objectives",
      "desired_outcomes",
      "facilitator_notes",
      "citations",
      "default_duration_minutes",
      "sort_order",
      "is_optional",
      "published",
      "module_id",
    ]) {
      if (key in body) patch[key] = body[key];
    }
    const { data, error } = await admin
      .from("wrt_lessons")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return jsonWrtError(error, route);
    return wrtOk({ lesson: data });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const route = "api/wrt/curriculum/lessons/[id]";
  try {
    const { id } = await context.params;
    const { admin } = await requireWrtCurriculumSession(true);
    const { error } = await admin.from("wrt_lessons").delete().eq("id", id);
    if (error) return jsonWrtError(error, route);
    return wrtOk({ ok: true });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
