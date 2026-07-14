import {
  resolveShareMomentMime,
  SHARE_MOMENT_BUCKET,
  SHARE_MOMENT_MAX_PHOTO_BYTES,
  SHARE_MOMENT_MAX_PHOTOS,
  SHARE_MOMENT_MAX_TOTAL_BYTES,
  shareMomentExtension,
} from "@/lib/share-moment-limits";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  type ApiErrorActor,
  respondWithLoggedError,
  resolveErrorActor,
} from "@wayfinder/supabase/error-log";
import { createServerClient } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isCounselorRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

type FileMeta = {
  name?: string;
  type?: string;
  size?: number;
};

async function ensureTeamMomentsBucket() {
  const admin = createServiceRoleClient();
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some((bucket) => bucket.name === SHARE_MOMENT_BUCKET)) {
    return admin;
  }
  const { error } = await admin.storage.createBucket(SHARE_MOMENT_BUCKET, {
    public: false,
    fileSizeLimit: SHARE_MOMENT_MAX_PHOTO_BYTES,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
  });
  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
  return admin;
}

export async function POST(request: Request) {
  const route = "api/team-moments/prepare-uploads";
  let actor: ApiErrorActor = {};
  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: "Please sign in again to continue." }, { status: 401 });
    }
    if (isCounselorRole(session.effectiveRole)) {
      return NextResponse.json(
        { error: "Share a Moment is for Joshua Tree team members only." },
        { status: 403 }
      );
    }

    const supabase = await createServerClient();
    actor = await resolveErrorActor(supabase, session.actorUserId);

    const body = (await request.json()) as { files?: FileMeta[] };
    const files = Array.isArray(body.files) ? body.files : [];
    if (files.length === 0) {
      return NextResponse.json({ error: "Add at least one photo." }, { status: 400 });
    }
    if (files.length > SHARE_MOMENT_MAX_PHOTOS) {
      return NextResponse.json(
        { error: `You can upload up to ${SHARE_MOMENT_MAX_PHOTOS} photos at a time.` },
        { status: 400 }
      );
    }

    let totalBytes = 0;
    const admin = await ensureTeamMomentsBucket();
    const uploads: {
      path: string;
      token: string;
      signedUrl: string;
      mimeType: string;
      filename: string;
      size: number;
    }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = String(file.name ?? `moment-${i + 1}.jpg`);
      const mime = resolveShareMomentMime({ type: String(file.type ?? ""), name });
      const size = Number(file.size ?? 0);
      if (!mime || !Number.isFinite(size) || size <= 0) {
        return NextResponse.json(
          { error: "Photos must be JPEG, PNG, WebP, or HEIC images." },
          { status: 400 }
        );
      }
      if (size > SHARE_MOMENT_MAX_PHOTO_BYTES) {
        return NextResponse.json(
          { error: "Each photo must be 25 MB or smaller." },
          { status: 400 }
        );
      }
      totalBytes += size;
      if (totalBytes > SHARE_MOMENT_MAX_TOTAL_BYTES) {
        return NextResponse.json(
          { error: "Total photo size is too large. Try fewer photos." },
          { status: 400 }
        );
      }

      const ext = shareMomentExtension(mime);
      const path = `${session.actorUserId}/${crypto.randomUUID()}-${i + 1}.${ext}`;
      const { data, error } = await admin.storage
        .from(SHARE_MOMENT_BUCKET)
        .createSignedUploadUrl(path);
      if (error || !data) {
        throw error ?? new Error("Could not prepare photo upload.");
      }

      uploads.push({
        path: data.path,
        token: data.token,
        signedUrl: data.signedUrl,
        mimeType: mime,
        filename: name,
        size,
      });
    }

    return NextResponse.json({ uploads });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
