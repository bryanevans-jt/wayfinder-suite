import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertReportingUser, getAvailableReportingStates } from "@/lib/wayfinder-caseload";
import { reportApiCatchError } from "@/lib/api-error";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email?.endsWith("@thejoshuatree.org")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    await assertReportingUser(admin, user.id);
    const states = await getAvailableReportingStates(admin, user.id);
    return NextResponse.json({ states });
  } catch (e) {
    return reportApiCatchError("api/wayfinder/states", e);
  }
}
