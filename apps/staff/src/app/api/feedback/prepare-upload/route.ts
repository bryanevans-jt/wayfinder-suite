import {
  FEEDBACK_ATTACHMENT_BUCKET,
  FEEDBACK_ATTACHMENT_MAX_BYTES,
  feedbackAttachmentExtension,
  resolveFeedbackAttachmentMime,
} from "@/lib/feedback-limits";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  type ApiErrorActor,
  respondWithLoggedError,
  resolveErrorActor,
} from "@wayfinder/supabase/error-log";
import { createServerClient } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

async function ensureFeedbackBucket() {
  const admin = createServiceRoleClient();
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some((bucket) => bucket.name === FEEDBACK_ATTACHMENT_BUCKET)) {
    return admin;
  }
  const { error } = await admin.storage.createBucket(FEEDBACK_ATTACHMENT_BUCKET, {
    public: false,
    fileSizeLimit: FEEDBACK_ATTACHMENT_MAX_BYTES,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "application/pdf",
    ],
  });
  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
  return admin;
}

export async function POST(request: Request) {
  const route = "api/feedback/prepare-upload";
  let actor: ApiErrorActor = {};
  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: "Please sign in again to continue." }, { status: 401 });
    }

    const supabase = await createServerClient();
    actor = await resolveErrorActor(supabase, session.actorUserId);

    const body = (await request.json()) as { name?: string; type?: string; size?: number };
    const mime = resolveFeedbackAttachmentMime({
      type: String(body.type ?? ""),
      name: String(body.name ?? ""),
    });
    const size = Number(body.size ?? 0);
    if (!mime || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json(
        { error: "Please attach a JPEG, PNG, WebP, HEIC image, or a PDF." },
        { status: 400 }
      );
    }
    if (size > FEEDBACK_ATTACHMENT_MAX_BYTES) {
      return NextResponse.json(
        { error: "Attachments must be 10 MB or smaller." },
        { status: 400 }
      );
    }

    const admin = await ensureFeedbackBucket();
    const ext = feedbackAttachmentExtension(mime);
    const path = `${session.actorUserId}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await admin.storage
      .from(FEEDBACK_ATTACHMENT_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      throw error ?? new Error("Could not prepare attachment upload.");
    }

    return NextResponse.json({
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
      mimeType: mime,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
