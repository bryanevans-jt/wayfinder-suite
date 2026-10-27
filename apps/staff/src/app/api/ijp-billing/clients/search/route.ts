import { clientDisplayName } from "@wayfinder/branding";
import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  let builder = auth.admin
    .from("clients")
    .select("id, full_name, contact_email, is_demo")
    .is("archived_at", null)
    .eq("is_demo", false)
    .order("full_name", { ascending: true })
    .limit(30);

  if (q.length >= 2) {
    const escaped = q.replace(/[%_,]/g, "");
    builder = builder.or(
      `full_name.ilike.%${escaped}%,contact_email.ilike.%${escaped}%`
    );
  }

  const { data, error } = await builder;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clients = (data ?? []).map((c) => ({
    id: c.id as string,
    name: clientDisplayName(c),
  }));

  return NextResponse.json({ clients });
}
