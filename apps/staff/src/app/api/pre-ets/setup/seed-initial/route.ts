import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  applyPreEtsClassSetupAssignments,
  bulkImportPreEtsClassSetup,
  isPreEtsClassSetupSchemaAvailable,
  parseClassSetupCsv,
  PRE_ETS_CLASS_SETUP_SCHEMA_MESSAGE,
} from "@wayfinder/supabase/pre-ets-class-setup";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

const SEED_NAME = "initial-class-setup-2025-2026.csv";

function resolveSeedCsvPath(): string {
  const candidates = [
    join(process.cwd(), "data/pre-ets", SEED_NAME),
    join(process.cwd(), "data", "pre-ets", SEED_NAME),
    join(process.cwd(), "..", "..", "data", "pre-ets", SEED_NAME),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error(`Seed file not found (${SEED_NAME}).`);
}

export async function POST() {
  const route = "api/pre-ets/setup/seed-initial";
  const auth = await requirePreEtsApi("settings");
  if (isPreEtsApiError(auth)) return auth;

  try {
    const admin = createServiceRoleClient();
    if (!(await isPreEtsClassSetupSchemaAvailable(admin))) {
      return NextResponse.json({ error: PRE_ETS_CLASS_SETUP_SCHEMA_MESSAGE }, { status: 503 });
    }

    const csv = readFileSync(resolveSeedCsvPath(), "utf8");
    const parsedRows = parseClassSetupCsv(csv);
    if (parsedRows.length === 0) {
      return NextResponse.json({ error: "Seed file has no rows." }, { status: 500 });
    }

    const imported = await bulkImportPreEtsClassSetup(admin, parsedRows, auth.userId);
    const sync = await applyPreEtsClassSetupAssignments(admin, auth.settings.school_year);

    return NextResponse.json({
      ok: true,
      seedFile: SEED_NAME,
      parsed: parsedRows.length,
      ...imported,
      schoolsLinked: sync.schoolsLinked,
      assignmentsApplied: sync.applied,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
