import { assertCommunityPartnersSession } from "@/lib/community-partners-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await assertCommunityPartnersSession();
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const token =
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ||
    process.env.MAPBOX_ACCESS_TOKEN?.trim();

  if (!token) {
    return NextResponse.json({
      configured: false,
      error: "Map is not configured. Set MAPBOX_ACCESS_TOKEN in your environment.",
    });
  }

  return NextResponse.json({ configured: true, token });
}
