import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { postGroupMeBotMessage } from "@/lib/groupme";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await assertNotPreviewMutation();
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text =
    typeof body.text === "string" && body.text.trim()
      ? body.text.trim()
      : "Joshua Tree Wayfinder test message — GroupMe bot is working.";

  const result = await postGroupMeBotMessage(text);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Send failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
