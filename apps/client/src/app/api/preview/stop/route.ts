import { staffAppOrigin } from "@wayfinder/supabase/preview-server";
import { stopPreviewSession } from "@wayfinder/supabase/preview-stop";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieGet = (name: string) => {
    const match = cookieHeader.match(
      new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
    );
    return match ? decodeURIComponent(match[1]!) : undefined;
  };

  const staffStop = `${staffAppOrigin()}/api/preview/stop`;
  const response = NextResponse.redirect(staffStop);
  await stopPreviewSession(cookieGet, response);
  return response;
}

export async function POST() {
  const cookieStore = await cookies();
  const staffStop = `${staffAppOrigin()}/api/preview/stop`;

  const response = NextResponse.json({ ok: true, redirectUrl: staffStop });
  await stopPreviewSession((name) => cookieStore.get(name)?.value, response);
  return response;
}
