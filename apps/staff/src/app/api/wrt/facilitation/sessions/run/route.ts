import {
  assertWrtDemoClientAllowedForRoleMany,
  jsonWrtError,
  requireWrtFacilitationSession,
  wrtOk,
} from "@/lib/staff-wrt-auth";
import { completeSession, scheduleSession } from "@/lib/staff-wrt-facilitation";
import type { WrtDeliveryMode, WrtRubricDomainKey } from "@wayfinder/supabase/staff-wrt-shared";
import { NextRequest } from "next/server";

/** Create a session and immediately record attendance / time / completion (WRT block). */
export async function POST(request: NextRequest) {
  const route = "api/wrt/facilitation/sessions/run";
  try {
    const { admin, userId, role } = await requireWrtFacilitationSession(true);
    const body = (await request.json()) as {
      lessonId?: string | null;
      lessonIds?: string[] | null;
      sessionBlockMinutes?: number;
      completedLessonIds?: string[] | null;
      deliveryMode?: WrtDeliveryMode;
      zoomUrl?: string | null;
      notes?: string | null;
      serviceDate?: string;
      rubricByClient?: Record<string, Partial<Record<WrtRubricDomainKey, { level: number; notes?: string | null }>>> | null;
      attendees?: Array<{
        clientId: string;
        enrollmentId: string | null;
        attendance: "present" | "absent";
        startTime?: string | null;
        endTime?: string | null;
      }>;
    };

    if (!Array.isArray(body.attendees) || body.attendees.length === 0) {
      return wrtOk({ error: "At least one attendee is required." }, { status: 400 });
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

    const lessonIds = Array.isArray(body.lessonIds) ? body.lessonIds.filter(Boolean) : [];
    const primaryLessonId =
      body.lessonId?.trim() || lessonIds[0] || null;

    const now = new Date();
    const session = await scheduleSession(admin, {
      lessonId: primaryLessonId,
      lessonIds: lessonIds.length ? lessonIds : primaryLessonId ? [primaryLessonId] : [],
      sessionBlockMinutes: blockMinutes,
      scheduledStart: now.toISOString(),
      scheduledEnd: null,
      deliveryMode: body.deliveryMode === "virtual" ? "virtual" : "in_person",
      zoomUrl: body.zoomUrl ?? null,
      notes: body.notes ?? null,
      createdBy: userId,
      attendees: body.attendees.map((a) => ({
        clientId: a.clientId,
        enrollmentId: a.enrollmentId,
      })),
    });

    const result = await completeSession(admin, {
      sessionId: session.id,
      actorUserId: userId,
      lessonId: primaryLessonId,
      lessonIds: lessonIds.length ? lessonIds : primaryLessonId ? [primaryLessonId] : [],
      sessionBlockMinutes: blockMinutes,
      completedLessonIds: Array.isArray(body.completedLessonIds) ? body.completedLessonIds : [],
      serviceDate: body.serviceDate,
      rubricByClient: body.rubricByClient ?? null,
      deliveryMode: body.deliveryMode === "virtual" ? "virtual" : "in_person",
      attendees: body.attendees.map((a) => ({
        clientId: a.clientId,
        attendance: a.attendance,
        startTime: a.startTime ?? null,
        endTime: a.endTime ?? null,
      })),
    });

    return wrtOk({ ok: true, session, ...result });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
