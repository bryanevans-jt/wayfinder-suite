import { jsonWrtError, requireWrtCurriculumSession, wrtOk } from "@/lib/staff-wrt-auth";
import { loadWrtCurriculumTree, seedWrtCurriculumIfEmpty } from "@/lib/staff-wrt-data";
import { NextRequest } from "next/server";

export async function GET() {
  const route = "api/wrt/curriculum";
  try {
    const { admin } = await requireWrtCurriculumSession(false);
    await seedWrtCurriculumIfEmpty(admin);
    const modules = await loadWrtCurriculumTree(admin);
    return wrtOk({ modules });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}

export async function POST(request: NextRequest) {
  const route = "api/wrt/curriculum";
  try {
    const { admin } = await requireWrtCurriculumSession(true);
    const body = (await request.json()) as {
      action?: string;
      title?: string;
      slug?: string;
      description?: string;
      citations?: string;
      is_optional?: boolean;
      published?: boolean;
      sort_order?: number;
    };

    if (body.action === "seed") {
      const result = await seedWrtCurriculumIfEmpty(admin);
      const modules = await loadWrtCurriculumTree(admin);
      return wrtOk({ ...result, modules });
    }

    const title = (body.title ?? "").trim();
    if (!title) {
      return wrtOk({ error: "Title is required." }, { status: 400 });
    }
    const slug =
      (body.slug ?? "").trim() ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const { count } = await admin.from("wrt_modules").select("id", { count: "exact", head: true });
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("wrt_modules")
      .insert({
        title,
        slug,
        description: body.description?.trim() || null,
        citations: body.citations?.trim() || null,
        is_optional: Boolean(body.is_optional),
        published: body.published !== false,
        sort_order: typeof body.sort_order === "number" ? body.sort_order : count ?? 0,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error) return jsonWrtError(error, route);
    return wrtOk({ module: data });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
