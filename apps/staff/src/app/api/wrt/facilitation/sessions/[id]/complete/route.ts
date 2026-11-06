import {
  assertWrtDemoClientAllowedForRoleMany,
  jsonWrtError,
  requireWrtFacilitationSession,
  wrtOk,
} from "@/lib/staff-wrt-auth";
import { completeSession } from "@/lib/staff-wrt-facilitation";
import type { WrtDeliveryMode, WrtRubricDomainKey } from "@wayfinder/supabase/staff-wrt-shared";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const route = "api/wrt/facilitation/sessions/[id]/complete";
  try {
    const { id } = await context.params;
    const { admin, userId, role } = await requireWrtFacilitationSession(true);
    const body = (await request.json()) as {
      lessonId?: string | null;
      lessonIds?: string[] | null;
      sessionBlockMinutes?: number;
      completedLessonIds?: string[] | null;
      deliveryMode?: WrtDeliveryMode;
      serviceDate?: string;
      rubricByClient?: Record<
        string,
        Partial<Record<WrtRubricDomainKey, { level: number; notes?: string | null }>>
      > | null;
      attendees?: Array<{
        clientId: string;
        attendance: "present" | "absent";
        startTime?: string | null;
        endTime?: string | null;
      }>;
    };

    if (!Array.isArray(body.attendees) || body.attendees.length === 0) {
      return wrtOk({ error: "Attendees are required." }, { status: 400 });
    }

    const blockMinutes = Number(body.sessionBlockMinutes ?? 0);
    if (!Number.isFinite(blockMinutes) || blockMinutes <= 0) {
      return wrtOk({ error: "Session block minutes must be greater than zero." }, { status: 400 });
    }

    await assertWrtDemoClientAllowedForRoleMany(
      admin,
      role,
      (body.attendees ?? []).map((a) => a.clientId)
    );
    if (body.rubricByClient && typeof body.rubricByClient === "object") {
      await assertWrtDemoClientAllowedForRoleMany(admin, role, Object.keys(body.rubricByClient));
    }

    const result = await completeSession(admin, {
      sessionId: id,
      actorUserId: userId,
      lessonId: body.lessonId ?? null,
      lessonIds: body.lessonIds ?? null,
      sessionBlockMinutes: blockMinutes,
      completedLessonIds: body.completedLessonIds ?? null,
      deliveryMode: body.deliveryMode,
      serviceDate: body.serviceDate,
      rubricByClient: body.rubricByClient ?? null,
      attendees: body.attendees,
    });
    return wrtOk({ ok: true, ...result });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
