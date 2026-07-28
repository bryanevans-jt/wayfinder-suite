import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  WRT_ACTIVITY_CODE,
  type WrtDeliveryMode,
  type WrtEnrollmentRow,
  type WrtModuleWithLessons,
  type WrtSessionRow,
} from "@wayfinder/supabase/staff-wrt-shared";
import { loadWrtCurriculumTree } from "@/lib/staff-wrt-data";
import { saveClientContactLog } from "@/lib/save-client-contact-log";

type Admin = ReturnType<typeof createServiceRoleClient>;

function mapEnrollment(row: Record<string, unknown>): WrtEnrollmentRow {
  return {
    id: String(row.id),
    client_id: String(row.client_id),
    delivery_mode: row.delivery_mode as WrtDeliveryMode,
    requested_hours: Number(row.requested_hours ?? 0),
    status: row.status as WrtEnrollmentRow["status"],
    enrolled_by: (row.enrolled_by as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    ended_at: (row.ended_at as string | null) ?? null,
  };
}

function mapSession(row: Record<string, unknown>): WrtSessionRow {
  return {
    id: String(row.id),
    lesson_id: (row.lesson_id as string | null) ?? null,
    scheduled_start: String(row.scheduled_start),
    scheduled_end: (row.scheduled_end as string | null) ?? null,
    delivery_mode: row.delivery_mode as WrtDeliveryMode,
    zoom_url: (row.zoom_url as string | null) ?? null,
    status: row.status as WrtSessionRow["status"],
    notes: (row.notes as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function resolveWrtActivityTypeId(admin: Admin): Promise<string | null> {
  const { data } = await admin
    .from("service_activity_types")
    .select("id")
    .eq("code", WRT_ACTIVITY_CODE)
    .eq("active", true)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

export async function loadActiveEnrollmentForClient(
  admin: Admin,
  clientId: string
): Promise<WrtEnrollmentRow | null> {
  const { data, error } = await admin
    .from("wrt_enrollments")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapEnrollment(data as Record<string, unknown>) : null;
}

export async function loadEnrollmentModuleIds(
  admin: Admin,
  enrollmentId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("wrt_enrollment_modules")
    .select("module_id")
    .eq("enrollment_id", enrollmentId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => String(r.module_id));
}

export async function loadCompletedLessonIds(
  admin: Admin,
  enrollmentId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("wrt_lesson_progress")
    .select("lesson_id")
    .eq("enrollment_id", enrollmentId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => String(r.lesson_id));
}

export async function loadCompletedHoursForEnrollment(
  admin: Admin,
  enrollmentId: string
): Promise<number> {
  const { data, error } = await admin
    .from("wrt_session_attendees")
    .select("duration_minutes, attendance, enrollment_id")
    .eq("enrollment_id", enrollmentId)
    .eq("attendance", "present");
  if (error) throw new Error(error.message);
  const minutes = (data ?? []).reduce(
    (sum, row) => sum + Number(row.duration_minutes ?? 0),
    0
  );
  return Math.round((minutes / 60) * 100) / 100;
}

export async function loadClientFacilitationSnapshot(
  admin: Admin,
  clientId: string
): Promise<{
  enrollment: WrtEnrollmentRow | null;
  moduleIds: string[];
  completedLessonIds: string[];
  completedHours: number;
  remainingHours: number | null;
  curriculum: WrtModuleWithLessons[];
  upcomingSessions: Array<
    WrtSessionRow & { lesson_title: string | null; attendance: string | null }
  >;
  clientName: string;
}> {
  const [{ data: client }, enrollment, curriculum] = await Promise.all([
    admin.from("clients").select("id, full_name, preferred_name").eq("id", clientId).maybeSingle(),
    loadActiveEnrollmentForClient(admin, clientId),
    loadWrtCurriculumTree(admin),
  ]);

  if (!client) {
    throw new Error("Client not found.");
  }

  const clientName =
    (client.preferred_name as string | null)?.trim() ||
    (client.full_name as string | null)?.trim() ||
    "Client";

  if (!enrollment) {
    return {
      enrollment: null,
      moduleIds: [],
      completedLessonIds: [],
      completedHours: 0,
      remainingHours: null,
      curriculum,
      upcomingSessions: [],
      clientName,
    };
  }

  const [moduleIds, completedLessonIds, completedHours, attendeeRows] = await Promise.all([
    loadEnrollmentModuleIds(admin, enrollment.id),
    loadCompletedLessonIds(admin, enrollment.id),
    loadCompletedHoursForEnrollment(admin, enrollment.id),
    admin
      .from("wrt_session_attendees")
      .select("session_id, attendance")
      .eq("client_id", clientId),
  ]);

  const sessionIds = [...new Set((attendeeRows.data ?? []).map((r) => String(r.session_id)))];
  const attendanceBySession = new Map(
    (attendeeRows.data ?? []).map((r) => [String(r.session_id), String(r.attendance)])
  );

  let upcomingSessions: Array<
    WrtSessionRow & { lesson_title: string | null; attendance: string | null }
  > = [];

  if (sessionIds.length > 0) {
    const nowIso = new Date().toISOString();
    const { data: sessions } = await admin
      .from("wrt_sessions")
      .select("*")
      .in("id", sessionIds)
      .eq("status", "scheduled")
      .gte("scheduled_start", nowIso)
      .order("scheduled_start", { ascending: true })
      .limit(20);

    const lessonIds = [
      ...new Set((sessions ?? []).map((s) => s.lesson_id).filter(Boolean) as string[]),
    ];
    const lessonTitleById = new Map<string, string>();
    if (lessonIds.length > 0) {
      const { data: lessons } = await admin.from("wrt_lessons").select("id, title").in("id", lessonIds);
      for (const l of lessons ?? []) {
        lessonTitleById.set(String(l.id), String(l.title));
      }
    }

    upcomingSessions = (sessions ?? []).map((s) => {
      const session = mapSession(s as Record<string, unknown>);
      return {
        ...session,
        lesson_title: session.lesson_id ? lessonTitleById.get(session.lesson_id) ?? null : null,
        attendance: attendanceBySession.get(session.id) ?? null,
      };
    });
  }

  const remainingHours =
    Math.round((enrollment.requested_hours - completedHours) * 100) / 100;

  return {
    enrollment,
    moduleIds,
    completedLessonIds,
    completedHours,
    remainingHours,
    curriculum,
    upcomingSessions,
    clientName,
  };
}

export async function createEnrollment(
  admin: Admin,
  input: {
    clientId: string;
    deliveryMode: WrtDeliveryMode;
    requestedHours: number;
    moduleIds: string[];
    enrolledBy: string;
  }
): Promise<WrtEnrollmentRow> {
  const existing = await loadActiveEnrollmentForClient(admin, input.clientId);
  if (existing) {
    throw new Error("Client already has an active WRT enrollment.");
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("wrt_enrollments")
    .insert({
      client_id: input.clientId,
      delivery_mode: input.deliveryMode,
      requested_hours: input.requestedHours,
      status: "active",
      enrolled_by: input.enrolledBy,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (input.moduleIds.length > 0) {
    const { error: modErr } = await admin.from("wrt_enrollment_modules").insert(
      input.moduleIds.map((module_id) => ({
        enrollment_id: data.id,
        module_id,
      }))
    );
    if (modErr) throw new Error(modErr.message);
  }

  return mapEnrollment(data as Record<string, unknown>);
}

export async function updateEnrollmentModules(
  admin: Admin,
  enrollmentId: string,
  moduleIds: string[]
) {
  const { error: delErr } = await admin
    .from("wrt_enrollment_modules")
    .delete()
    .eq("enrollment_id", enrollmentId);
  if (delErr) throw new Error(delErr.message);

  if (moduleIds.length === 0) return;
  const { error } = await admin.from("wrt_enrollment_modules").insert(
    moduleIds.map((module_id) => ({ enrollment_id: enrollmentId, module_id }))
  );
  if (error) throw new Error(error.message);
}

export async function endEnrollment(admin: Admin, enrollmentId: string) {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("wrt_enrollments")
    .update({ status: "ended", ended_at: now, updated_at: now })
    .eq("id", enrollmentId);
  if (error) throw new Error(error.message);
}

export async function scheduleSession(
  admin: Admin,
  input: {
    lessonId: string | null;
    scheduledStart: string;
    scheduledEnd?: string | null;
    deliveryMode: WrtDeliveryMode;
    zoomUrl?: string | null;
    notes?: string | null;
    createdBy: string;
    attendees: Array<{ clientId: string; enrollmentId: string | null }>;
  }
): Promise<WrtSessionRow> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("wrt_sessions")
    .insert({
      lesson_id: input.lessonId,
      scheduled_start: input.scheduledStart,
      scheduled_end: input.scheduledEnd ?? null,
      delivery_mode: input.deliveryMode,
      zoom_url: input.zoomUrl ?? null,
      status: "scheduled",
      notes: input.notes ?? null,
      created_by: input.createdBy,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (input.attendees.length > 0) {
    const { error: attErr } = await admin.from("wrt_session_attendees").insert(
      input.attendees.map((a) => ({
        session_id: data.id,
        client_id: a.clientId,
        enrollment_id: a.enrollmentId,
        attendance: "present",
        duration_minutes: 30,
        lesson_completed: false,
        created_at: now,
        updated_at: now,
      }))
    );
    if (attErr) throw new Error(attErr.message);
  }

  return mapSession(data as Record<string, unknown>);
}

export type SessionAttendeeInput = {
  clientId: string;
  attendance: "present" | "absent";
  durationMinutes: number;
  startTime?: string | null;
  endTime?: string | null;
  lessonCompleted: boolean;
};

export async function completeSession(
  admin: Admin,
  input: {
    sessionId: string;
    actorUserId: string;
    lessonId: string | null;
    attendees: SessionAttendeeInput[];
    serviceDate?: string;
  }
): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];
  const now = new Date().toISOString();
  const activityTypeId = await resolveWrtActivityTypeId(admin);

  const { data: session, error: sessErr } = await admin
    .from("wrt_sessions")
    .select("*")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (sessErr) throw new Error(sessErr.message);
  if (!session) throw new Error("Session not found.");

  let lessonTitle = "Workplace Readiness Training";
  const lessonId = input.lessonId ?? (session.lesson_id as string | null);
  if (lessonId) {
    const { data: lesson } = await admin
      .from("wrt_lessons")
      .select("title")
      .eq("id", lessonId)
      .maybeSingle();
    if (lesson?.title) lessonTitle = String(lesson.title);
  }

  for (const att of input.attendees) {
    const enrollment = await loadActiveEnrollmentForClient(admin, att.clientId);

    const { data: existing } = await admin
      .from("wrt_session_attendees")
      .select("id")
      .eq("session_id", input.sessionId)
      .eq("client_id", att.clientId)
      .maybeSingle();

    const attendeePatch = {
      attendance: att.attendance,
      duration_minutes: att.durationMinutes,
      start_time: att.startTime ?? null,
      end_time: att.endTime ?? null,
      lesson_completed: att.attendance === "present" && att.lessonCompleted,
      enrollment_id: enrollment?.id ?? null,
      updated_at: now,
    };

    let attendeeId = existing?.id as string | undefined;
    if (existing) {
      const { error } = await admin
        .from("wrt_session_attendees")
        .update(attendeePatch)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await admin
        .from("wrt_session_attendees")
        .insert({
          session_id: input.sessionId,
          client_id: att.clientId,
          ...attendeePatch,
          created_at: now,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      attendeeId = String(inserted.id);
    }

    if (att.attendance !== "present") continue;

    if (att.lessonCompleted && enrollment && lessonId) {
      const { error: progErr } = await admin.from("wrt_lesson_progress").upsert(
        {
          enrollment_id: enrollment.id,
          lesson_id: lessonId,
          completed_at: now,
          completed_by: input.actorUserId,
        },
        { onConflict: "enrollment_id,lesson_id" }
      );
      if (progErr) throw new Error(progErr.message);
    } else if (!att.lessonCompleted && enrollment && lessonId) {
      await admin
        .from("wrt_lesson_progress")
        .delete()
        .eq("enrollment_id", enrollment.id)
        .eq("lesson_id", lessonId);
    }

    if (att.durationMinutes > 0) {
      const contactNotes = `Workplace Readiness Training — ${lessonTitle} (${att.durationMinutes} min)${
        att.lessonCompleted ? "; lesson marked complete" : "; progress session (lesson not complete)"
      }.`;
      const time =
        activityTypeId && att.durationMinutes > 0
          ? {
              activityTypeId,
              durationMinutes: att.durationMinutes,
              serviceDate: input.serviceDate,
              startTime: att.startTime ?? undefined,
              endTime: att.endTime ?? undefined,
            }
          : undefined;

      const result = await saveClientContactLog(admin, input.actorUserId, {
        clientId: att.clientId,
        contactNotes,
        internalNotes: "Logged from WRT session (admin facilitation preview).",
        time,
      });
      if (!result.ok) {
        warnings.push(result.error ?? "Contact log failed for a client.");
      } else if (result.warning) {
        warnings.push(result.warning);
      }
    }

    void attendeeId;
  }

  const { error: doneErr } = await admin
    .from("wrt_sessions")
    .update({
      status: "completed",
      lesson_id: lessonId,
      updated_at: now,
    })
    .eq("id", input.sessionId);
  if (doneErr) throw new Error(doneErr.message);

  return { warnings };
}

export async function searchClientsForWrt(
  admin: Admin,
  query: string
): Promise<Array<{ id: string; name: string }>> {
  const q = query.trim();
  let builder = admin
    .from("clients")
    .select("id, full_name, preferred_name")
    .order("full_name", { ascending: true })
    .limit(25);
  if (q) {
    builder = builder.or(`full_name.ilike.%${q}%,preferred_name.ilike.%${q}%`);
  }
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    id: String(c.id),
    name:
      (c.preferred_name as string | null)?.trim() ||
      (c.full_name as string | null)?.trim() ||
      "Client",
  }));
}
