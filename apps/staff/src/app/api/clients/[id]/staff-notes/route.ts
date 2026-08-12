import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import {
  canViewStaffOnlyClientNotes,
  canWriteStaffOnlyClientNotes,
} from "@wayfinder/supabase/roles";
import { loadStaffNameById } from "@/lib/staff-names";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_NOTE_LENGTH = 4000;

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAppSession();
  if (!session || !canViewStaffOnlyClientNotes(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: clientId } = await context.params;
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("client_staff_notes")
    .select("id, body, author_user_id, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const authorIds = [...new Set((data ?? []).map((n) => n.author_user_id as string))];
  const names = await loadStaffNameById(admin, authorIds, "Staff");

  return NextResponse.json({
    notes: (data ?? []).map((n) => ({
      id: n.id as string,
      body: n.body as string,
      author_user_id: n.author_user_id as string,
      author_name: names.get(n.author_user_id as string) ?? "Staff",
      created_at: n.created_at as string,
    })),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getAppSession();
  if (!session || !canWriteStaffOnlyClientNotes(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await assertNotPreviewMutation();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Read-only preview" },
      { status: 403 }
    );
  }

  const { id: clientId } = await context.params;
  const body = (await request.json()) as { body?: string };
  const text = (body.body ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Note text is required" }, { status: 400 });
  }
  if (text.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ error: "Note is too long" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: client } = await admin.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("client_staff_notes")
    .insert({
      client_id: clientId,
      author_user_id: session.effectiveUserId,
      body: text,
    })
    .select("id, body, author_user_id, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not save note" }, { status: 500 });
  }

  return NextResponse.json({
    note: {
      id: data.id as string,
      body: data.body as string,
      author_user_id: data.author_user_id as string,
      author_name: "You",
      created_at: data.created_at as string,
    },
  });
}
