import {
  SHARE_MOMENT_BUCKET,
  SHARE_MOMENT_LINK_TTL_SECONDS,
  SHARE_MOMENT_MAX_ATTACHMENT_BYTES,
  SHARE_MOMENT_MAX_PHOTO_BYTES,
  SHARE_MOMENT_MAX_PHOTOS,
  SHARE_MOMENT_MAX_TOTAL_BYTES,
  shareMomentExtension,
} from "@/lib/share-moment-limits";
import { getGoogleAuth, sendEmail } from "@/lib/google-mail";
import { SUPPORT_CONTACT_EMAIL } from "@wayfinder/branding";
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

export const maxDuration = 60;

type PhotoInput = {
  path?: string;
  mimeType?: string;
  filename?: string;
  size?: number;
};

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

async function removeStoragePaths(
  admin: ReturnType<typeof createServiceRoleClient>,
  paths: string[]
) {
  if (paths.length === 0) return;
  const { error } = await admin.storage.from(SHARE_MOMENT_BUCKET).remove(paths);
  if (error) {
    console.error("[team-moments] Failed to delete staged photos:", error.message, paths);
  }
}

export async function POST(request: Request) {
  const route = "api/team-moments/share";
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

    const body = (await request.json()) as {
      clientName?: string;
      teamMemberName?: string;
      notes?: string;
      photos?: PhotoInput[];
    };

    const clientName = String(body.clientName ?? "").trim();
    const teamMemberName = String(body.teamMemberName ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const photos = Array.isArray(body.photos) ? body.photos : [];

    if (!clientName) {
      return NextResponse.json({ error: "Client name is required." }, { status: 400 });
    }
    if (!teamMemberName) {
      return NextResponse.json({ error: "Team member name is required." }, { status: 400 });
    }
    if (!notes) {
      return NextResponse.json({ error: "Please add a short note about this moment." }, { status: 400 });
    }
    if (photos.length === 0) {
      return NextResponse.json({ error: "Add at least one photo." }, { status: 400 });
    }
    if (photos.length > SHARE_MOMENT_MAX_PHOTOS) {
      return NextResponse.json(
        { error: `You can upload up to ${SHARE_MOMENT_MAX_PHOTOS} photos at a time.` },
        { status: 400 }
      );
    }

    const prefix = `${session.actorUserId}/`;
    let totalBytes = 0;
    for (const photo of photos) {
      const path = String(photo.path ?? "");
      const mime = String(photo.mimeType ?? "");
      const size = Number(photo.size ?? 0);
      if (!path.startsWith(prefix) || path.includes("..")) {
        return NextResponse.json({ error: "Invalid photo upload." }, { status: 400 });
      }
      if (!ALLOWED_TYPES.has(mime) || !Number.isFinite(size) || size <= 0) {
        return NextResponse.json(
          { error: "Photos must be JPEG, PNG, WebP, or HEIC images." },
          { status: 400 }
        );
      }
      if (size > SHARE_MOMENT_MAX_PHOTO_BYTES) {
        return NextResponse.json({ error: "Each photo must be 25 MB or smaller." }, { status: 400 });
      }
      totalBytes += size;
      if (totalBytes > SHARE_MOMENT_MAX_TOTAL_BYTES) {
        return NextResponse.json(
          { error: "Total photo size is too large. Try fewer photos." },
          { status: 400 }
        );
      }
    }

    const admin = createServiceRoleClient();
    const attachments: {
      filename: string;
      content: string;
      encoding: "base64";
      mimeType?: string;
    }[] = [];
    const downloadLinks: string[] = [];
    const attachedPaths: string[] = [];
    const linkedPaths: string[] = [];
    let attachmentBytes = 0;

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const path = String(photo.path);
      const mime = String(photo.mimeType);
      const size = Number(photo.size);
      const ext = shareMomentExtension(mime);
      const filename = `moment-${i + 1}.${ext}`;

      if (attachmentBytes + size <= SHARE_MOMENT_MAX_ATTACHMENT_BYTES) {
        const { data: blob, error: downloadErr } = await admin.storage
          .from(SHARE_MOMENT_BUCKET)
          .download(path);
        if (downloadErr || !blob) {
          throw downloadErr ?? new Error(`Could not load ${filename} for email.`);
        }
        const buffer = Buffer.from(await blob.arrayBuffer());
        attachmentBytes += buffer.length;
        attachments.push({
          filename,
          content: buffer.toString("base64"),
          encoding: "base64",
          mimeType: mime,
        });
        attachedPaths.push(path);
        continue;
      }

      const { data: signed, error: signedErr } = await admin.storage
        .from(SHARE_MOMENT_BUCKET)
        .createSignedUrl(path, SHARE_MOMENT_LINK_TTL_SECONDS);
      if (signedErr || !signed?.signedUrl) {
        throw signedErr ?? new Error(`Could not create download link for ${filename}`);
      }
      downloadLinks.push(`${filename}: ${signed.signedUrl}`);
      linkedPaths.push(path);
    }

    const submittedAt = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "full",
      timeStyle: "short",
    });

    const text = [
      "A team member shared a client moment from Wayfinder Pro.",
      "",
      `Client: ${clientName}`,
      `Team member: ${teamMemberName}`,
      `Submitted by: ${actor.userName ?? session.actorUserId}`,
      `Submitted at: ${submittedAt}`,
      "",
      "Notes:",
      notes,
      "",
      attachments.length > 0
        ? `Photos attached: ${attachments.length}`
        : "Photos were too large to attach in email; use the download links below.",
      ...(downloadLinks.length > 0
        ? [
            "",
            "Full-quality photo links (available for 24 hours, then removed from storage):",
            ...downloadLinks,
          ]
        : []),
    ].join("\n");

    const auth = await getGoogleAuth();
    await sendEmail(auth, {
      to: SUPPORT_CONTACT_EMAIL,
      subject: `Team moment: ${clientName}`,
      text,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    // Attached originals are already in the email — delete immediately.
    await removeStoragePaths(admin, attachedPaths);
    // Linked originals stay for 24h so the email links work; cron cleans those up.

    return NextResponse.json({
      ok: true,
      deletedImmediately: attachedPaths.length,
      retainedForDownloadLinks: linkedPaths.length,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Missing Google OAuth")) {
      return respondWithLoggedError(
        "staff",
        route,
        err,
        actor,
        503,
        "Photo sharing is not configured yet. Ask your administrator to add Google OAuth credentials to Wayfinder Pro."
      );
    }

    return respondWithLoggedError("staff", route, err, actor);
  }
}
