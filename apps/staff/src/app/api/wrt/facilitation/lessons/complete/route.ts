import { jsonWrtError, requireWrtCurriculumSession, wrtOk } from "@/lib/staff-wrt-auth";
import { markLessonCompleteForClients } from "@/lib/staff-wrt-facilitation";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const route = "api/wrt/facilitation/lessons/complete";
  try {
    const { admin, userId } = await requireWrtCurriculumSession(true);
    const body = (await request.json()) as {
      lessonId?: string;
      clientIds?: string[];
    };

    const lessonId = body.lessonId?.trim();
    const clientIds = Array.isArray(body.clientIds)
      ? body.clientIds.map((id) => String(id).trim()).filter(Boolean)
      : [];

    if (!lessonId) {
      return wrtOk({ error: "lessonId is required." }, { status: 400 });
    }
    if (clientIds.length === 0) {
      return wrtOk({ error: "At least one present client is required." }, { status: 400 });
    }

    const result = await markLessonCompleteForClients(admin, {
      lessonId,
      actorUserId: userId,
      clientIds,
    });

    return wrtOk({ ok: true, ...result });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
