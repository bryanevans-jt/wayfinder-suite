import { jsonWrtError, requireWrtCurriculumSession, wrtOk } from "@/lib/staff-wrt-auth";
import { completeSession } from "@/lib/staff-wrt-facilitation";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const route = "api/wrt/facilitation/sessions/[id]/complete";
  try {
    const { id } = await context.params;
    const { admin, userId } = await requireWrtCurriculumSession(true);
    const body = (await request.json()) as {
      lessonId?: string | null;
      serviceDate?: string;
      attendees?: Array<{
        clientId: string;
        attendance: "present" | "absent";
        durationMinutes: number;
        startTime?: string | null;
        endTime?: string | null;
        lessonCompleted: boolean;
      }>;
    };

    if (!Array.isArray(body.attendees) || body.attendees.length === 0) {
      return wrtOk({ error: "Attendees are required." }, { status: 400 });
    }

    const result = await completeSession(admin, {
      sessionId: id,
      actorUserId: userId,
      lessonId: body.lessonId ?? null,
      serviceDate: body.serviceDate,
      attendees: body.attendees,
    });
    return wrtOk({ ok: true, ...result });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
