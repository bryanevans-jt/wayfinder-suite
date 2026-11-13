import { isFeedbackStatus } from "@/lib/feedback";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  type ApiErrorActor,
  respondWithLoggedError,
  resolveErrorActor,
} from "@wayfinder/supabase/error-log";
import { createServerClient } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isAdminTierRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const route = "api/feedback/[id]";
  let actor: ApiErrorActor = {};
  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: "Please sign in again to continue." }, { status: 401 });
    }
    if (!isAdminTierRole(session.actorRole)) {
      return NextResponse.json({ error: "Admins only." }, { status: 403 });
    }

    const supabase = await createServerClient();
    actor = await resolveErrorActor(supabase, session.actorUserId);

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing feedback id." }, { status: 400 });
    }

    const body = (await request.json()) as {
      status?: string;
      decisionNotes?: string | null;
    };
    const status = String(body.status ?? "").trim();
    if (!isFeedbackStatus(status)) {
      return NextResponse.json({ error: "Choose a valid status." }, { status: 400 });
    }

    const patch: { status: string; decision_notes?: string | null } = { status };
    if ("decisionNotes" in body) {
      const notes = body.decisionNotes == null ? null : String(body.decisionNotes).trim();
      patch.decision_notes = notes || null;
    }

    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("feedback_submissions")
      .update(patch)
      .eq("id", id)
      .select(
        "id, created_at, updated_at, submitter_name, submitter_role, feedback_type, title, status, decision_notes"
      )
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }
    return NextResponse.json({ submission: data });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
