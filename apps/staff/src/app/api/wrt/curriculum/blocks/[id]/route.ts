import { jsonWrtError, requireWrtCurriculumSession, wrtOk } from "@/lib/staff-wrt-auth";
import { isValidWrtBlockType } from "@wayfinder/supabase/staff-wrt-shared";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const route = "api/wrt/curriculum/blocks/[id]";
  try {
    const { id } = await context.params;
    const { admin } = await requireWrtCurriculumSession(true);
    const body = (await request.json()) as Record<string, unknown>;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of ["title", "body", "url", "meta", "sort_order", "lesson_id"]) {
      if (key in body) patch[key] = body[key];
    }
    if (typeof body.block_type === "string") {
      if (!isValidWrtBlockType(body.block_type)) {
        return wrtOk({ error: "Invalid block type." }, { status: 400 });
      }
      patch.block_type = body.block_type;
    }
    const { data, error } = await admin
      .from("wrt_lesson_blocks")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return jsonWrtError(error, route);
    return wrtOk({ block: data });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const route = "api/wrt/curriculum/blocks/[id]";
  try {
    const { id } = await context.params;
    const { admin } = await requireWrtCurriculumSession(true);
    const { error } = await admin.from("wrt_lesson_blocks").delete().eq("id", id);
    if (error) return jsonWrtError(error, route);
    return wrtOk({ ok: true });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
