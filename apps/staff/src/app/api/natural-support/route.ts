import {
  assertNaturalSupportClientAccess,
  NaturalSupportAccessError,
  requireServiceRoleAdmin,
} from "@/lib/natural-support-access";
import {
  inviteNaturalSupportForClient,
  listNaturalSupportContacts,
} from "@wayfinder/supabase/natural-support-invite";
import {
  respondWithAccessOrLoggedError,
  respondWithLoggedError,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

async function jsonError(error: unknown, route: string) {
  if (error instanceof NaturalSupportAccessError) {
    return respondWithAccessOrLoggedError("staff", route, error);
  }
  return respondWithLoggedError("staff", route, error);
}

export async function GET(request: Request) {
  const route = "api/natural-support";
  try {
    const clientId = new URL(request.url).searchParams.get("clientId");
    if (!clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    }

    await assertNaturalSupportClientAccess(clientId);
    const admin = requireServiceRoleAdmin();
    const contacts = await listNaturalSupportContacts(admin, clientId);
    return NextResponse.json({ contacts });
  } catch (error) {
    return jsonError(error, route);
  }
}

export async function POST(request: Request) {
  const route = "api/natural-support";
  try {
    const body = (await request.json()) as {
      clientId?: string;
      fullName?: string;
      email?: string;
      relationship?: string;
      relationshipOther?: string | null;
    };

    if (!body.clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    }

    await assertNaturalSupportClientAccess(body.clientId);
    const admin = requireServiceRoleAdmin();

    await inviteNaturalSupportForClient(admin, {
      clientId: body.clientId,
      fullName: body.fullName ?? "",
      email: body.email ?? "",
      relationship: body.relationship ?? "",
      relationshipOther: body.relationshipOther ?? null,
    });

    const contacts = await listNaturalSupportContacts(admin, body.clientId);
    return NextResponse.json({ ok: true, contacts });
  } catch (error) {
    return jsonError(error, route);
  }
}
