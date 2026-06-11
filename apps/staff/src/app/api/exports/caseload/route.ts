import { assertStaffExportSession } from "@/lib/export-access";
import { caseloadToCsv, loadEsCaseloadRows } from "@/lib/es-exports";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await assertStaffExportSession(["es"]);
  if (auth.error) {
    return auth.error;
  }

  const rows = await loadEsCaseloadRows(auth.supabase, auth.user.id);
  const csv = caseloadToCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="wayfinder-caseload.csv"',
    },
  });
}
