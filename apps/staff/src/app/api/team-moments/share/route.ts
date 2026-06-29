import { getGoogleAuth, sendEmail } from "@/lib/google-mail";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isCounselorRole } from "@wayfinder/supabase/roles";
import { SUPPORT_CONTACT_EMAIL } from "@wayfinder/branding";
import {
  respondWithLoggedError,
  resolveErrorActor,
} from "@wayfinder/supabase/error-log";
import { createServerClient } from "@wayfinder/supabase";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function POST(request: Request) {
  const route = "api/team-moments/share";
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
    const actor = await resolveErrorActor(supabase, session.actorUserId);

    const form = await request.formData();
    const clientName = String(form.get("clientName") ?? "").trim();
    const teamMemberName = String(form.get("teamMemberName") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const photoEntries = form.getAll("photos");

    if (!clientName) {
      return NextResponse.json({ error: "Client name is required." }, { status: 400 });
    }
    if (!teamMemberName) {
      return NextResponse.json({ error: "Team member name is required." }, { status: 400 });
    }
    if (!notes) {
      return NextResponse.json({ error: "Please add a short note about this moment." }, { status: 400 });
    }

    const photos = photoEntries.filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (photos.length === 0) {
      return NextResponse.json({ error: "Add at least one photo." }, { status: 400 });
    }
    if (photos.length > MAX_PHOTOS) {
      return NextResponse.json(
        { error: `You can upload up to ${MAX_PHOTOS} photos at a time.` },
        { status: 400 }
      );
    }

    let totalBytes = 0;
    const attachments: {
      filename: string;
      content: string;
      encoding: "base64";
      mimeType?: string;
    }[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const mime = photo.type || "application/octet-stream";
      if (!ALLOWED_TYPES.has(mime)) {
        return NextResponse.json(
          { error: "Photos must be JPEG, PNG, or WebP images." },
          { status: 400 }
        );
      }
      if (photo.size > MAX_PHOTO_BYTES) {
        return NextResponse.json(
          { error: "Each photo must be 4 MB or smaller." },
          { status: 400 }
        );
      }
      totalBytes += photo.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        return NextResponse.json(
          { error: "Total upload size is too large. Try fewer or smaller photos." },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await photo.arrayBuffer());
      const ext =
        mime === "image/png"
          ? "png"
          : mime === "image/webp"
            ? "webp"
            : mime === "image/heic" || mime === "image/heif"
              ? "heic"
              : "jpg";
      attachments.push({
        filename: `moment-${i + 1}.${ext}`,
        content: buffer.toString("base64"),
        encoding: "base64",
        mimeType: mime,
      });
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
      `Photos attached: ${attachments.length}`,
    ].join("\n");

    const auth = await getGoogleAuth();
    await sendEmail(auth, {
      to: SUPPORT_CONTACT_EMAIL,
      subject: `Team moment: ${clientName}`,
      text,
      attachments,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Missing Google OAuth")) {
      return NextResponse.json(
        {
          error:
            "Photo sharing is not configured yet. Ask your administrator to add Google OAuth credentials to Wayfinder Pro.",
        },
        { status: 503 }
      );
    }

    try {
      const session = await getAppSession();
      if (session) {
        const supabase = await createServerClient();
        const actor = await resolveErrorActor(supabase, session.actorUserId);
        return respondWithLoggedError("staff", route, err, actor);
      }
      return respondWithLoggedError("staff", route, err);
    } catch {
      return respondWithLoggedError("staff", route, err);
    }
  }
}
