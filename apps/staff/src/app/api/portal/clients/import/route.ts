import { assertPortalMutation, assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import {
  buildClientImportReference,
  buildClientImportTemplateCsv,
  importClientRows,
  loadClientImportLookups,
  type ClientImportInputRow,
} from "@wayfinder/supabase";
import { NextRequest } from "next/server";

const MAX_ROWS_PER_BATCH = 25;

export async function GET() {
  try {
    const { admin } = await assertPortalSession("admin");
    const lookups = await loadClientImportLookups(admin);
    const csv = buildClientImportTemplateCsv(lookups);
    const reference = buildClientImportReference(lookups);

    return Response.json({ csv, reference });
  } catch (error) {
    return await jsonPortalError(error, "api/portal/clients/import");
  }
}

type ImportBody = {
  rows?: ClientImportInputRow[];
  startRow?: number;
};

export async function POST(request: NextRequest) {
  try {
    const { admin } = await assertPortalMutation("admin");
    const body = (await request.json()) as ImportBody;
    const rows = body.rows ?? [];

    if (rows.length === 0) {
      return Response.json({ error: "No rows to import" }, { status: 400 });
    }
    if (rows.length > MAX_ROWS_PER_BATCH) {
      return Response.json(
        { error: `Import at most ${MAX_ROWS_PER_BATCH} rows per request` },
        { status: 400 }
      );
    }

    const lookups = await loadClientImportLookups(admin);
    const startRow = body.startRow ?? 2;
    const result = await importClientRows(admin, rows, lookups, startRow);

    return Response.json(result);
  } catch (error) {
    return await jsonPortalError(error, "api/portal/clients/import");
  }
}
