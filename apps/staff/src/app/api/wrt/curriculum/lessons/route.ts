import { jsonWrtError, requireWrtCurriculumSession, wrtOk } from "@/lib/staff-wrt-auth";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const route = "api/wrt/curriculum/lessons";
  try {
    const { admin } = await requireWrtCurriculumSession(true);
    const body = (await request.json()) as {
      module_id?: string;
      title?: string;
      slug?: string;
      objectives?: string;
      desired_outcomes?: string;
      facilitator_notes?: string;
      citations?: string;
      default_duration_minutes?: number;
      is_optional?: boolean;
      published?: boolean;
      sort_order?: number;
    };
    const moduleId = (body.module_id ?? "").trim();
    const title = (body.title ?? "").trim();
    if (!moduleId || !title) {
      return wrtOk({ error: "Module and title are required." }, { status: 400 });
    }
    const slug =
      (body.slug ?? "").trim() ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const { count } = await admin
      .from("wrt_lessons")
      .select("id", { count: "exact", head: true })
      .eq("module_id", moduleId);

    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("wrt_lessons")
      .insert({
        module_id: moduleId,
        title,
        slug,
        objectives: body.objectives?.trim() || null,
        desired_outcomes: body.desired_outcomes?.trim() || null,
        facilitator_notes: body.facilitator_notes?.trim() || null,
        citations: body.citations?.trim() || null,
        default_duration_minutes: body.default_duration_minutes ?? 30,
        is_optional: Boolean(body.is_optional),
        published: body.published !== false,
        sort_order: typeof body.sort_order === "number" ? body.sort_order : count ?? 0,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error) return jsonWrtError(error, route);
    return wrtOk({ lesson: data });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
