import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import type { PreEtsSettingsRow } from "@wayfinder/supabase/pre-ets-settings";
import { loadPreEtsSettings } from "@wayfinder/supabase/pre-ets-settings";
import JSZip from "jszip";
import { buildAuthorizationRosterPdf } from "@/lib/pre-ets-authorization-roster-pdf";
import { listPreEtsTestRostersForMonth } from "@/lib/pre-ets-list-test-rosters";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

import {
  PRE_ETS_TEST_ROSTER_ZIP_CHUNK_SIZE,
  preEtsTestRosterZipPartCount,
} from "@/lib/pre-ets-test-roster-export-config";

export { PRE_ETS_TEST_ROSTER_ZIP_CHUNK_SIZE, preEtsTestRosterZipPartCount };

function normalizeServiceMonth(month: string): string {
  const trimmed = month.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  return trimmed.slice(0, 10);
}

export type BuildTestRostersZipResult =
  | {
      ok: true;
      zipBytes: Uint8Array;
      rosterCount: number;
      skippedEmpty: number;
      serviceMonth: string;
      attachmentName: string;
      part: number;
      partCount: number;
      totalRosters: number;
    }
  | { ok: false; error: string };

export async function buildPreEtsTestRostersZip(
  admin: AdminClient,
  input: {
    serviceMonth: string;
    part?: number;
    chunkSize?: number;
    /** Email export: one ZIP with every roster (may timeout when count is very large). */
    combineAllParts?: boolean;
    settings?: Pick<
      PreEtsSettingsRow,
      "template_roster_doc_id" | "template_individual_roster_doc_id" | "service_codes"
    >;
  }
): Promise<BuildTestRostersZipResult> {
  const serviceMonth = normalizeServiceMonth(input.serviceMonth);
  const chunkSize = input.chunkSize ?? PRE_ETS_TEST_ROSTER_ZIP_CHUNK_SIZE;
  const settings = input.settings ?? (await loadPreEtsSettings(admin));

  const { rosters } = await listPreEtsTestRostersForMonth(admin, serviceMonth.slice(0, 7));
  const totalRosters = rosters.length;
  if (totalRosters === 0) {
    return {
      ok: false,
      error: `No rosters with approved students (PID required) found for ${serviceMonth.slice(0, 7)}.`,
    };
  }

  const combineAll = input.combineAllParts === true;
  const partCount = combineAll ? 1 : preEtsTestRosterZipPartCount(totalRosters, chunkSize);
  const part = combineAll ? 1 : Math.min(Math.max(input.part ?? 1, 1), partCount);
  const offset = combineAll ? 0 : (part - 1) * chunkSize;
  const slice = combineAll ? rosters : rosters.slice(offset, offset + chunkSize);

  const zip = new JSZip();
  const usedNames = new Map<string, number>();
  let rosterCount = 0;
  let skippedEmpty = 0;

  for (const row of slice) {
    const built = await buildAuthorizationRosterPdf(admin, row.authorizationId, settings);
    if (!built.ok) {
      if (built.skip) skippedEmpty++;
      continue;
    }

    let baseName = built.fileLabel || `roster-${row.authorizationId.slice(0, 8)}`;
    const seen = usedNames.get(baseName) ?? 0;
    usedNames.set(baseName, seen + 1);
    if (seen > 0) {
      baseName = `${baseName} (${seen + 1})`;
    }

    zip.file(`${baseName}.pdf`, built.pdfBytes);
    rosterCount++;
  }

  if (rosterCount === 0) {
    return {
      ok: false,
      error: `No PDFs could be built for part ${part} of ${partCount}.`,
    };
  }

  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  const monthLabel = serviceMonth.slice(0, 7);
  const attachmentName =
    partCount === 1
      ? `pre-ets-test-rosters-${monthLabel}.zip`
      : `pre-ets-test-rosters-${monthLabel}-part-${part}-of-${partCount}.zip`;

  return {
    ok: true,
    zipBytes,
    rosterCount,
    skippedEmpty,
    serviceMonth,
    attachmentName,
    part,
    partCount,
    totalRosters,
  };
}
