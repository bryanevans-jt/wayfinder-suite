import { createServerClient, createClientWithInvite, isEsRole } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
  USER_FACING_SYSTEM_ERROR,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

type Body = {
  name?: string;
  email?: string;
  serviceId?: string;
  officeId?: string;
  counselorId?: string;
};

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isEsRole(profile?.role)) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    return NextResponse.json({ error: USER_FACING_SYSTEM_ERROR }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await createClientWithInvite(admin, {
    name: body.name ?? "",
    email: body.email ?? "",
    serviceId: body.serviceId ?? "",
    officeId: body.officeId ?? "",
    counselorId: body.counselorId ?? "",
    esUserId: user.id,
  });

  if ("error" in result) {
    const status = result.error.toLowerCase().includes("already") ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, clientId: result.clientId });
}
