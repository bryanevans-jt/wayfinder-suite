import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { isCounselorRole } from "@wayfinder/supabase/roles";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

type Body = {
  showPriorServiceHistory?: boolean;
};

export async function PATCH(request: Request) {
  const session = await getAppSession();
  if (!session || !isCounselorRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const show = body.showPriorServiceHistory !== false;

  try {
    const admin = createServiceRoleClient();
    const { error } = await admin
      .from("profiles")
      .update({ counselor_show_prior_service_history: show })
      .eq("id", session.effectiveUserId);

    if (error) {
      if (error.message.includes("counselor_show_prior_service_history")) {
        return NextResponse.json({ ok: true, showPriorServiceHistory: show, persisted: false });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } catch {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("profiles")
      .update({ counselor_show_prior_service_history: show })
      .eq("id", session.effectiveUserId);
    if (error) {
      if (error.message.includes("counselor_show_prior_service_history")) {
        return NextResponse.json({ ok: true, showPriorServiceHistory: show, persisted: false });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, showPriorServiceHistory: show });
}
