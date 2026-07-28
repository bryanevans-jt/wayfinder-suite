import { jsonWrtError, requireWrtCurriculumSession, wrtOk } from "@/lib/staff-wrt-auth";
import { completeSession, scheduleSession } from "@/lib/staff-wrt-facilitation";
import type { WrtDeliveryMode } from "@wayfinder/supabase/staff-wrt-shared";
import { NextRequest } from "next/server";

/** Create a session and immediately record attendance / time / completion (ES “log this session” flow). */
export async function POST(request: NextRequest) {
  const route = "api/wrt/facilitation/sessions/run";
  try {
    const { admin, userId } = await requireWrtCurriculumSession(true);
    const body = (await request.json()) as {
      lessonId?: string | null;
      deliveryMode?: WrtDeliveryMode;
      zoomUrl?: string | null;
      notes?: string | null;
      serviceDate?: string;
      attendees?: Array<{
        clientId: string;
        enrollmentId: string | null;
        attendance: "present" | "absent";
        durationMinutes: number;
        startTime?: string | null;
        endTime?: string | null;
        lessonCompleted: boolean;
      }>;
    };

    if (!Array.isArray(body.attendees) || body.attendees.length === 0) {
      return wrtOk({ error: "At least one attendee is required." }, { status: 400 });
    }

    const now = new Date();
    const session = await scheduleSession(admin, {
      lessonId: body.lessonId ?? null,
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
      lessonId: body.lessonId ?? null,
      serviceDate: body.serviceDate,
      attendees: body.attendees.map((a) => ({
        clientId: a.clientId,
        attendance: a.attendance,
        durationMinutes: a.durationMinutes,
        startTime: a.startTime,
        endTime: a.endTime,
        lessonCompleted: a.lessonCompleted,
      })),
    });

    return wrtOk({ ok: true, session, ...result });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
