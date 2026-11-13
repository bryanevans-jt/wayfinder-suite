import {
  FEEDBACK_STATUSES,
  isFeedbackStatus,
  parseFeedbackSubmitInput,
  isSafeFeedbackAttachmentPath,
  type FeedbackStatus,
} from "@/lib/feedback";
import {
  buildFeedbackWebhookPayload,
  notifyFeedbackWebhook,
  resolveFeedbackWebhookConfig,
} from "@/lib/feedback-webhook";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  type ApiErrorActor,
  respondWithLoggedError,
  resolveErrorActor,
} from "@wayfinder/supabase/error-log";
import { createServerClient } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isAdminTierRole, roleDisplayName } from "@wayfinder/supabase/roles";
import { APP_VERSION } from "@wayfinder/branding";
import { after, NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/feedback";
  let actor: ApiErrorActor = {};
  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: "Please sign in again to continue." }, { status: 401 });
    }
    const supabase = await createServerClient();
    actor = await resolveErrorActor(supabase, session.actorUserId);

    const url = new URL(request.url);
    const mineOnly = url.searchParams.get("mine") === "1";
    const statusFilter = url.searchParams.get("status");

    if (isAdminTierRole(session.actorRole) && !mineOnly) {
      const admin = createServiceRoleClient();
      let query = admin
        .from("feedback_submissions")
        .select(
          "id, created_at, updated_at, submitted_by, submitter_name, submitter_email, submitter_role, feedback_type, title, description, page_url, user_agent, app_version, attachment_path, status, decision_notes"
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter && isFeedbackStatus(statusFilter)) {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ submissions: data ?? [], statuses: FEEDBACK_STATUSES });
    }

    const { data, error } = await supabase
      .from("feedback_submissions")
      .select(
        "id, created_at, feedback_type, title, description, status, page_url, attachment_path"
      )
      .eq("submitted_by", session.actorUserId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ submissions: data ?? [] });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}

export async function POST(request: Request) {
  const route = "api/feedback";
  let actor: ApiErrorActor = {};
  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: "Please sign in again to continue." }, { status: 401 });
    }

    const supabase = await createServerClient();
    actor = await resolveErrorActor(supabase, session.actorUserId);

    const body = (await request.json()) as Record<string, unknown>;
    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null;
    const appVersionFromClient = String(body.appVersion ?? "").trim();
    const appVersion =
      appVersionFromClient ||
      (commit ? `${APP_VERSION} (${commit})` : APP_VERSION);

    const parsed = parseFeedbackSubmitInput({
      type: String(body.type ?? ""),
      title: String(body.title ?? ""),
      description: String(body.description ?? ""),
      pageUrl: body.pageUrl != null ? String(body.pageUrl) : null,
      userAgent: body.userAgent != null ? String(body.userAgent) : null,
      appVersion,
      attachmentPath: body.attachmentPath != null ? String(body.attachmentPath) : null,
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    if (
      parsed.value.attachmentPath &&
      !isSafeFeedbackAttachmentPath(parsed.value.attachmentPath, session.actorUserId)
    ) {
      return NextResponse.json({ error: "That attachment path is not valid." }, { status: 400 });
    }

    const submitterName = actor.userName?.trim() || null;
    const submitterRole = session.actorRole;
    const row = {
      submitted_by: session.actorUserId,
      submitter_name: submitterName,
      submitter_email: session.actorEmail ?? null,
      submitter_role: submitterRole,
      feedback_type: parsed.value.type,
      title: parsed.value.title,
      description: parsed.value.description,
      page_url: parsed.value.pageUrl,
      user_agent: parsed.value.userAgent,
      app_version: parsed.value.appVersion,
      attachment_path: parsed.value.attachmentPath,
      status: "new" satisfies FeedbackStatus,
    };

    // Service role insert so counselors / instructors are not blocked by missing
    // table grants before migration apply; still stamps submitted_by = actor.
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("feedback_submissions")
      .insert(row)
      .select("id, created_at, feedback_type, title, description, page_url, status")
      .single();
    if (error) throw error;

    const webhookConfig = resolveFeedbackWebhookConfig();
    const payload = buildFeedbackWebhookPayload({
      id: data.id as string,
      type: parsed.value.type,
      title: parsed.value.title,
      description: parsed.value.description,
      submitterName,
      submitterRole: submitterRole ? roleDisplayName(submitterRole) : null,
      pageUrl: parsed.value.pageUrl,
      createdAt: data.created_at as string,
      staffAppUrl: webhookConfig.staffAppUrl,
    });
    // Schedule after the response so serverless freeze/abort does not cut off
    // the Radar POST (production saw AbortError with fire-and-forget void).
    after(() => {
      void notifyFeedbackWebhook(payload);
    });

    return NextResponse.json({
      ok: true,
      submission: data,
      message: "Thank you — we received your note and will take a look.",
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
