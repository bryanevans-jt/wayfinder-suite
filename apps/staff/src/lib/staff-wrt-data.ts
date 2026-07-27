import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import type {
  WrtBlockType,
  WrtLessonBlockRow,
  WrtLessonRow,
  WrtModuleRow,
  WrtModuleWithLessons,
} from "@wayfinder/supabase/staff-wrt-shared";
import { WRT_SEED_CURRICULUM } from "@wayfinder/supabase/wrt-seed-curriculum";

type Admin = ReturnType<typeof createServiceRoleClient>;

function mapModule(row: Record<string, unknown>): WrtModuleRow {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    citations: (row.citations as string | null) ?? null,
    sort_order: Number(row.sort_order ?? 0),
    is_optional: Boolean(row.is_optional),
    published: Boolean(row.published),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapLesson(row: Record<string, unknown>): WrtLessonRow {
  return {
    id: String(row.id),
    module_id: String(row.module_id),
    slug: String(row.slug),
    title: String(row.title),
    objectives: (row.objectives as string | null) ?? null,
    desired_outcomes: (row.desired_outcomes as string | null) ?? null,
    facilitator_notes: (row.facilitator_notes as string | null) ?? null,
    citations: (row.citations as string | null) ?? null,
    default_duration_minutes: Number(row.default_duration_minutes ?? 30),
    sort_order: Number(row.sort_order ?? 0),
    is_optional: Boolean(row.is_optional),
    published: Boolean(row.published),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapBlock(row: Record<string, unknown>): WrtLessonBlockRow {
  return {
    id: String(row.id),
    lesson_id: String(row.lesson_id),
    block_type: row.block_type as WrtBlockType,
    title: (row.title as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    url: (row.url as string | null) ?? null,
    meta: (row.meta as Record<string, unknown>) ?? {},
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function loadWrtCurriculumTree(admin: Admin): Promise<WrtModuleWithLessons[]> {
  const { data: modules, error: modErr } = await admin
    .from("wrt_modules")
    .select("*")
    .order("sort_order", { ascending: true });
  if (modErr) throw new Error(modErr.message);

  const { data: lessons, error: lesErr } = await admin
    .from("wrt_lessons")
    .select("*")
    .order("sort_order", { ascending: true });
  if (lesErr) throw new Error(lesErr.message);

  const { data: blocks, error: blkErr } = await admin
    .from("wrt_lesson_blocks")
    .select("*")
    .order("sort_order", { ascending: true });
  if (blkErr) throw new Error(blkErr.message);

  const blocksByLesson = new Map<string, WrtLessonBlockRow[]>();
  for (const raw of blocks ?? []) {
    const b = mapBlock(raw as Record<string, unknown>);
    const list = blocksByLesson.get(b.lesson_id) ?? [];
    list.push(b);
    blocksByLesson.set(b.lesson_id, list);
  }

  const lessonsByModule = new Map<string, WrtModuleWithLessons["lessons"]>();
  for (const raw of lessons ?? []) {
    const lesson = mapLesson(raw as Record<string, unknown>);
    const withBlocks = { ...lesson, blocks: blocksByLesson.get(lesson.id) ?? [] };
    const list = lessonsByModule.get(lesson.module_id) ?? [];
    list.push(withBlocks);
    lessonsByModule.set(lesson.module_id, list);
  }

  return (modules ?? []).map((raw) => {
    const mod = mapModule(raw as Record<string, unknown>);
    return { ...mod, lessons: lessonsByModule.get(mod.id) ?? [] };
  });
}

export async function seedWrtCurriculumIfEmpty(admin: Admin): Promise<{ seeded: boolean; moduleCount: number }> {
  const { count, error } = await admin
    .from("wrt_modules")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) {
    return { seeded: false, moduleCount: count ?? 0 };
  }

  const now = new Date().toISOString();
  let moduleOrder = 0;
  for (const mod of WRT_SEED_CURRICULUM) {
    const { data: moduleRow, error: modErr } = await admin
      .from("wrt_modules")
      .insert({
        slug: mod.slug,
        title: mod.title,
        description: mod.description,
        citations: mod.citations,
        sort_order: moduleOrder++,
        is_optional: Boolean(mod.is_optional),
        published: true,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();
    if (modErr) throw new Error(modErr.message);

    let lessonOrder = 0;
    for (const lesson of mod.lessons) {
      const { data: lessonRow, error: lesErr } = await admin
        .from("wrt_lessons")
        .insert({
          module_id: moduleRow.id,
          slug: lesson.slug,
          title: lesson.title,
          objectives: lesson.objectives,
          desired_outcomes: lesson.desired_outcomes,
          facilitator_notes: lesson.facilitator_notes,
          citations: lesson.citations,
          default_duration_minutes: lesson.default_duration_minutes,
          sort_order: lessonOrder++,
          is_optional: Boolean(lesson.is_optional),
          published: true,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();
      if (lesErr) throw new Error(lesErr.message);

      let blockOrder = 0;
      const blockRows = lesson.blocks.map((b) => ({
        lesson_id: lessonRow.id,
        block_type: b.block_type,
        title: b.title ?? null,
        body: b.body ?? null,
        url: b.url ?? null,
        meta: b.meta ?? {},
        sort_order: blockOrder++,
        created_at: now,
        updated_at: now,
      }));
      if (blockRows.length > 0) {
        const { error: blkErr } = await admin.from("wrt_lesson_blocks").insert(blockRows);
        if (blkErr) throw new Error(blkErr.message);
      }
    }
  }

  return { seeded: true, moduleCount: WRT_SEED_CURRICULUM.length };
}
