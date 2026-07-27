import { jsonWrtError, requireWrtCurriculumSession, wrtOk } from "@/lib/staff-wrt-auth";
import { isValidWrtBlockType } from "@wayfinder/supabase/staff-wrt-shared";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const route = "api/wrt/curriculum/blocks";
  try {
    const { admin } = await requireWrtCurriculumSession(true);
    const body = (await request.json()) as {
      lesson_id?: string;
      block_type?: string;
      title?: string;
      body?: string;
      url?: string;
      meta?: Record<string, unknown>;
      sort_order?: number;
    };
    const lessonId = (body.lesson_id ?? "").trim();
    const blockType = (body.block_type ?? "").trim();
    if (!lessonId || !isValidWrtBlockType(blockType)) {
      return wrtOk({ error: "Lesson and valid block type are required." }, { status: 400 });
    }
    const { count } = await admin
      .from("wrt_lesson_blocks")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", lessonId);
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("wrt_lesson_blocks")
      .insert({
        lesson_id: lessonId,
        block_type: blockType,
        title: body.title?.trim() || null,
        body: body.body?.trim() || null,
        url: body.url?.trim() || null,
        meta: body.meta ?? {},
        sort_order: typeof body.sort_order === "number" ? body.sort_order : count ?? 0,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error) return jsonWrtError(error, route);
    return wrtOk({ block: data });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
