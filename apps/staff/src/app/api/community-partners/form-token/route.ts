import { issuePublicFormToken } from "@/lib/public-form-guard";
import { NextResponse } from "next/server";

export async function GET() {
  const issued = issuePublicFormToken();
  if ("error" in issued) {
    return NextResponse.json({ error: issued.error }, { status: 503 });
  }
  return NextResponse.json(issued);
}
