import {
  assertWrtDemoClientAllowedForRoleMany,
  jsonWrtError,
  requireWrtFacilitationSession,
  wrtOk,
} from "@/lib/staff-wrt-auth";
import { scheduleSession } from "@/lib/staff-wrt-facilitation";
import type { WrtDeliveryMode } from "@wayfinder/supabase/staff-wrt-shared";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const route = "api/wrt/facilitation/sessions";
  try {
    const { admin, userId, role } = await requireWrtFacilitationSession(true);
    const body = (await request.json()) as {
      lessonId?: string | null;
      lessonIds?: string[] | null;
      sessionBlockMinutes?: number | null;
      scheduledStart?: string;
      scheduledEnd?: string | null;
      deliveryMode?: WrtDeliveryMode;
      zoomUrl?: string | null;
      notes?: string | null;
      attendees?: Array<{ clientId: string; enrollmentId: string | null }>;
    };

    if (!body.scheduledStart) {
      return wrtOk({ error: "Scheduled start is required." }, { status: 400 });
    }
    if (!Array.isArray(body.attendees) || body.attendees.length === 0) {
      return wrtOk({ error: "At least one attendee is required." }, { status: 400 });
    }

    await assertWrtDemoClientAllowedForRoleMany(
      admin,
      role,
      body.attendees.map((a) => a.clientId)
    );

    const lessonIds =
      Array.isArray(body.lessonIds) && body.lessonIds.length > 0
        ? body.lessonIds.filter(Boolean)
        : body.lessonId
          ? [body.lessonId]
          : [];

    const session = await scheduleSession(admin, {
      lessonId: body.lessonId ?? lessonIds[0] ?? null,
      lessonIds: lessonIds.length ? lessonIds : null,
      sessionBlockMinutes:
        body.sessionBlockMinutes != null && Number.isFinite(Number(body.sessionBlockMinutes))
          ? Number(body.sessionBlockMinutes)
          : undefined,
      scheduledStart: body.scheduledStart,
      scheduledEnd: body.scheduledEnd ?? null,
      deliveryMode: body.deliveryMode === "virtual" ? "virtual" : "in_person",
      zoomUrl: body.zoomUrl ?? null,
      notes: body.notes ?? null,
      createdBy: userId,
      attendees: body.attendees,
    });
    return wrtOk({ session });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
