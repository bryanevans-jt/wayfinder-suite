import { V2_ROSTER_IMPORT_RETIRED_MESSAGE } from "@wayfinder/supabase/v2-roster-import-policy";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function retiredResponse() {
  return NextResponse.json({ error: V2_ROSTER_IMPORT_RETIRED_MESSAGE }, { status: 410 });
}

/** Legacy v2 roster CSV import — retired after initial migration. */
export async function GET() {
  return retiredResponse();
}

export async function POST() {
  return retiredResponse();
}
