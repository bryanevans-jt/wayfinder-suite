import { jsonWrtError, requireWrtCurriculumSession, wrtOk } from "@/lib/staff-wrt-auth";
import {
  createEnrollment,
  endEnrollment,
  updateEnrollmentModules,
} from "@/lib/staff-wrt-facilitation";
import type { WrtDeliveryMode } from "@wayfinder/supabase/staff-wrt-shared";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const route = "api/wrt/facilitation/enroll";
  try {
    const { admin, userId } = await requireWrtCurriculumSession(true);
    const body = (await request.json()) as {
      clientId?: string;
      deliveryMode?: WrtDeliveryMode;
      requestedHours?: number;
      moduleIds?: string[];
    };
    const clientId = body.clientId?.trim();
    if (!clientId) {
      return wrtOk({ error: "Client is required." }, { status: 400 });
    }
    const requestedHours = Number(body.requestedHours ?? 0);
    if (!Number.isFinite(requestedHours) || requestedHours < 0) {
      return wrtOk({ error: "Requested hours must be a non-negative number." }, { status: 400 });
    }
    const enrollment = await createEnrollment(admin, {
      clientId,
      deliveryMode: body.deliveryMode === "virtual" ? "virtual" : "in_person",
      requestedHours,
      moduleIds: Array.isArray(body.moduleIds) ? body.moduleIds : [],
      enrolledBy: userId,
    });
    return wrtOk({ enrollment });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}

export async function PATCH(request: NextRequest) {
  const route = "api/wrt/facilitation/enroll";
  try {
    const { admin } = await requireWrtCurriculumSession(true);
    const body = (await request.json()) as {
      enrollmentId?: string;
      action?: string;
      moduleIds?: string[];
      requestedHours?: number;
      deliveryMode?: WrtDeliveryMode;
    };
    const enrollmentId = body.enrollmentId?.trim();
    if (!enrollmentId) {
      return wrtOk({ error: "Enrollment is required." }, { status: 400 });
    }

    if (body.action === "end") {
      await endEnrollment(admin, enrollmentId);
      return wrtOk({ ok: true });
    }

    if (Array.isArray(body.moduleIds)) {
      await updateEnrollmentModules(admin, enrollmentId, body.moduleIds);
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.requestedHours === "number" && Number.isFinite(body.requestedHours)) {
      patch.requested_hours = body.requestedHours;
    }
    if (body.deliveryMode === "virtual" || body.deliveryMode === "in_person") {
      patch.delivery_mode = body.deliveryMode;
    }
    if (Object.keys(patch).length > 1) {
      const { error } = await admin.from("wrt_enrollments").update(patch).eq("id", enrollmentId);
      if (error) return jsonWrtError(error, route);
    }

    return wrtOk({ ok: true });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
