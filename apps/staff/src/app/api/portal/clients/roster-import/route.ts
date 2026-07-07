import { assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import {
  analyzeRosterImportCsv,
  buildRosterImportReference,
  buildRosterImportTemplateCsv,
  importRosterClientBatch,
  loadRosterImportLookups,
  parseRosterImportCsv,
  type RosterImportInputRow,
} from "@wayfinder/supabase/client-roster-import";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { admin } = await assertPortalSession("admin");
    const lookups = await loadRosterImportLookups(admin);
    return Response.json({
      csv: buildRosterImportTemplateCsv(lookups),
      reference: buildRosterImportReference(lookups),
    });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await assertPortalSession("admin");
    const body = (await request.json()) as { csv?: string; rows?: unknown[] };

    let rows: RosterImportInputRow[];
    if (typeof body.csv === "string") {
      const parsed = parseRosterImportCsv(body.csv);
      if (parsed.error) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }
      rows = parsed.rows;
    } else if (Array.isArray(body.rows)) {
      rows = body.rows as RosterImportInputRow[];
    } else {
      return Response.json({ error: "csv or rows required" }, { status: 400 });
    }

    const preview = analyzeRosterImportCsv(rows);
    if (preview.validRows === 0) {
      return Response.json(
        { error: preview.issues[0] ?? "No valid rows to import.", preview },
        { status: 400 }
      );
    }

    const result = await importRosterClientBatch(admin, rows);
    return Response.json({ ...result, preview });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
