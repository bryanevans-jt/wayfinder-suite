/**
 * ONE-TIME OPS: Copy production November 2026 IJP attestations → October 2026.
 *
 * Bryan's intent: pages were signed in November but should have applied to October.
 *
 * Default mode is DRY RUN (read-only). Does not write DB or Drive unless:
 *   APPLY=1 node scripts/one-off/copy-nov-attestations-to-october.mjs --apply
 *
 * Idempotent: skips clients that already have an October production attestation.
 * Never mutates November rows or November Drive files.
 *
 * Env (apps/staff/.env.local or process env):
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   For --apply Drive work: GOOGLE_OAUTH_CLIENT_ID/SECRET + GOOGLE_OAUTH_REFRESH_TOKEN
 *
 * Rollback after apply: delete inserted October attestation rows by id and trash
 * their new Drive file ids (listed in the apply manifest JSON).
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { Readable } from "stream";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
/** Prefer staff workspace installs for googleapis / pdf-lib when applying. */
function loadGoogleApis() {
  try {
    return require("googleapis");
  } catch {
    return require(path.join(process.cwd(), "apps/staff/node_modules/googleapis"));
  }
}
function loadPdfLib() {
  try {
    return require("pdf-lib");
  } catch {
    return require(path.join(process.cwd(), "apps/staff/node_modules/pdf-lib"));
  }
}

const SOURCE_MONTH = "2026-11-01";
const TARGET_MONTH = "2026-10-01";
/** Printed AttestationDate on regenerated PDFs + captured_at timestamp. */
const ATTESTATION_DATE_YMD = "2026-11-02";
const CAPTURED_AT_ISO = "2026-11-02T17:00:00.000Z"; // noon ET on 11/2
const DEFAULT_TEMPLATE_DOC_ID = "1r8ekYATmXRbfAxNOQJd_sWJwbprUU9A17Gou7fKvVHE";

function loadEnv(filePath) {
  try {
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const k = m[1].trim();
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* missing file ok */
  }
}

loadEnv(".env.local");
loadEnv("apps/staff/.env.local");

const APPLY = process.argv.includes("--apply") && process.env.APPLY === "1";
const OUT_DIR = path.join("scripts", "one-off", "artifacts");

function clientLabel(row) {
  const name = (row.full_name || "").trim();
  if (name) return name;
  const email = (row.contact_email || "").trim();
  if (email) return email;
  return row.client_id;
}

function sanitizeDriveName(name) {
  const cleaned = String(name || "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 200) || "unknown";
}

function formatAttestationDateLabel(ymd) {
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function getGoogleAuth() {
  const { google } = loadGoogleApis();
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth credentials for Drive/Docs apply.");
  }
  const auth = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "https://developers.google.com/oauthplayground"
  );
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

async function ensureMonthFolder(drive, rootId, monthStart) {
  const [year, month] = monthStart.split("-");
  const monthKey = `${year}-${month}`;

  async function ensure(parent, name) {
    const listed = await drive.files.list({
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
      q: `'${parent}' in parents and mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`,
      fields: "files(id)",
      pageSize: 1,
    });
    const existing = listed.data.files?.[0]?.id;
    if (existing) return existing;
    const created = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parent],
      },
      fields: "id",
    });
    if (!created.data.id) throw new Error(`Could not create folder ${name}`);
    return created.data.id;
  }

  const yearId = await ensure(rootId, year);
  return ensure(yearId, monthKey);
}

async function copyDriveFileToFolder(drive, fileId, folderId, fileName) {
  const copied = await drive.files.copy({
    supportsAllDrives: true,
    fileId,
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    fields: "id,name",
  });
  if (!copied.data.id) throw new Error(`Drive copy failed for ${fileId}`);
  return { fileId: copied.data.id, fileName: copied.data.name || fileName };
}

async function uploadPdfBuffer(drive, folderId, fileName, buffer) {
  const uploaded = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(buffer),
    },
    fields: "id,name",
  });
  if (!uploaded.data.id) throw new Error("Drive upload returned no id");
  return { fileId: uploaded.data.id, fileName: uploaded.data.name || fileName };
}

/**
 * Regenerate digital attestation PDF with AttestationDate = 11/02/2026.
 * Mirrors staff exportIjpAttestationPdf text-fill path (signature embed is best-effort:
 * if pdf-lib embed helper is unavailable, we still fill the dated template; Bryan can
 * re-open if signature placement looks off — preferred vs leaving a Nov-dated page).
 */
async function regenerateDigitalAttestationPdf(opts) {
  const { google } = loadGoogleApis();
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  const docs = google.docs({ version: "v1", auth });

  const copy = await drive.files.copy({
    supportsAllDrives: true,
    fileId: opts.templateDocId,
    requestBody: { name: `[TEMP] IJP Attestation ${opts.clientName} ${TARGET_MONTH}` },
  });
  const tempDocId = copy.data.id;
  if (!tempDocId) throw new Error("Could not copy attestation template");

  try {
    const placeholders = {
      AttestationProviderName: opts.facilitatorName || "",
      ProviderInvoiceNumber: opts.providerInvoiceNumber || "",
      InvoiceNumber: opts.providerInvoiceNumber || "",
      AuthorizationNumber: opts.authorizationNumber || "",
      AuthNumber: opts.authorizationNumber || "",
      AttestationDate: formatAttestationDateLabel(ATTESTATION_DATE_YMD),
    };
    const requests = Object.entries(placeholders).map(([key, value]) => ({
      replaceAllText: {
        containsText: { text: `{{${key}}}`, matchCase: false },
        replaceText: String(value ?? ""),
      },
    }));
    if (requests.length) {
      await docs.documents.batchUpdate({
        documentId: tempDocId,
        requestBody: { requests },
      });
    }

    const pdfRes = await drive.files.export(
      { fileId: tempDocId, mimeType: "application/pdf" },
      { responseType: "arraybuffer" }
    );
    let pdfBytes = new Uint8Array(pdfRes.data);

    if (opts.signatureDataUrl?.startsWith("data:image/")) {
      try {
        // Match apps/staff/src/lib/ijp-attestation-signature-pdf.ts layout.
        const { PDFDocument, rgb } = loadPdfLib();
        const doc = await PDFDocument.load(pdfBytes);
        const page = doc.getPage(0);
        const x = 108;
        const y = 154;
        const width = 180;
        const height = 48;
        const m = opts.signatureDataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (m) {
          const raw = Buffer.from(m[2], "base64");
          const img = m[1].includes("png")
            ? await doc.embedPng(raw)
            : await doc.embedJpg(raw);
          page.drawRectangle({
            x,
            y,
            width,
            height,
            color: rgb(1, 1, 1),
            borderWidth: 0,
          });
          const scale = Math.min(width / img.width, height / img.height, 1);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          page.drawImage(img, {
            x: x + (width - drawW) / 2,
            y: y + (height - drawH) / 2,
            width: drawW,
            height: drawH,
          });
          pdfBytes = await doc.save();
        }
      } catch (e) {
        console.warn(
          `  ! signature embed failed for ${opts.clientName}; uploading dated PDF without pad:`,
          e instanceof Error ? e.message : e
        );
      }
    }

    return Buffer.from(pdfBytes);
  } finally {
    await drive.files.delete({ supportsAllDrives: true, fileId: tempDocId }).catch(() => undefined);
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing Supabase URL or service role key.\n" +
        "Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (e.g. apps/staff/.env.local).\n" +
        "Dry-run report was also produced via Supabase MCP against Wayfinder-Production."
    );
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  console.log(`Mode: ${APPLY ? "APPLY (writes enabled)" : "DRY RUN (read-only)"}`);
  console.log(`Source month: ${SOURCE_MONTH}  →  Target month: ${TARGET_MONTH}`);
  console.log(`Attestation date / captured_at: ${ATTESTATION_DATE_YMD} / ${CAPTURED_AT_ISO}\n`);

  const { data: novRows, error: novErr } = await admin
    .from("ijp_monthly_attestations")
    .select(
      "id, client_id, service_month, is_test, capture_method, captured_at, captured_by, facilitator_name, attestation_drive_file_id, attestation_drive_file_name, signature_data_url"
    )
    .eq("service_month", SOURCE_MONTH)
    .eq("is_test", false)
    .order("client_id");
  if (novErr) throw new Error(novErr.message);

  const clientIds = [...new Set((novRows ?? []).map((r) => r.client_id))];
  const { data: clients } = await admin
    .from("clients")
    .select("id, full_name, contact_email, authorization_number")
    .in("id", clientIds.length ? clientIds : ["00000000-0000-0000-0000-000000000000"]);
  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));

  const { data: octAtts } = await admin
    .from("ijp_monthly_attestations")
    .select("id, client_id, attestation_drive_file_id, captured_at")
    .eq("service_month", TARGET_MONTH)
    .eq("is_test", false);
  const octAttByClient = new Map((octAtts ?? []).map((r) => [r.client_id, r]));

  const { data: octInvoices } = await admin
    .from("ijp_billing_invoices")
    .select(
      "id, client_id, status, missing_attestation, provider_invoice_number, invoice_date, total_hours"
    )
    .eq("service_month", TARGET_MONTH)
    .eq("is_test", false)
    .in(
      "client_id",
      clientIds.length ? clientIds : ["00000000-0000-0000-0000-000000000000"]
    );
  const octInvByClient = new Map((octInvoices ?? []).map((r) => [r.client_id, r]));

  const { data: settings } = await admin
    .from("ijp_billing_settings")
    .select(
      "template_attestation_doc_id, drive_attestation_folder_id, drive_signature_temp_folder_id"
    )
    .limit(1)
    .maybeSingle();

  const plan = [];
  for (const row of novRows ?? []) {
    const client = clientById.get(row.client_id) ?? { id: row.client_id };
    const existingOct = octAttByClient.get(row.client_id);
    const octInv = octInvByClient.get(row.client_id) ?? null;
    const canRegenerate =
      row.capture_method === "digital" && Boolean(row.signature_data_url);
    const action = existingOct
      ? "skip_existing_october"
      : canRegenerate
        ? "copy_db_and_regenerate_pdf"
        : "copy_db_and_drive_file_copy";

    plan.push({
      action,
      sourceAttestationId: row.id,
      clientId: row.client_id,
      clientName: clientLabel({ ...client, client_id: row.client_id }),
      captureMethod: row.capture_method,
      hasSignature: Boolean(row.signature_data_url),
      facilitatorName: row.facilitator_name,
      capturedBy: row.captured_by,
      sourceDriveFileId: row.attestation_drive_file_id,
      sourceDriveFileName: row.attestation_drive_file_name,
      sourceCapturedAt: row.captured_at,
      octoberAttestationId: existingOct?.id ?? null,
      octoberInvoice: octInv
        ? {
            id: octInv.id,
            status: octInv.status,
            missing_attestation: octInv.missing_attestation,
            provider_invoice_number: octInv.provider_invoice_number,
            invoice_date: octInv.invoice_date,
            total_hours: octInv.total_hours,
          }
        : null,
      pdfStrategy: canRegenerate
        ? `Regenerate Google Doc PDF with AttestationDate=${formatAttestationDateLabel(ATTESTATION_DATE_YMD)}; embed stored signature; upload to Drive .../2026/2026-10/`
        : `Drive files.copy of November PDF into .../2026/2026-10/ (upload capture — printed date on scan may remain original; DB captured_at still set to ${ATTESTATION_DATE_YMD})`,
      dbFieldsCopied: [
        "client_id",
        "is_test=false",
        "capture_method",
        "captured_by",
        "facilitator_name",
        "signature_data_url (digital only)",
      ],
      dbFieldsChanged: {
        service_month: TARGET_MONTH,
        captured_at: CAPTURED_AT_ISO,
        attestation_drive_file_id: "(new October file id)",
        attestation_drive_file_name: `IJP Attestation - ${sanitizeDriveName(clientLabel({ ...client, client_id: row.client_id }))} - 2026-10.pdf`,
        id: "(new uuid)",
      },
      billingSideEffects: octInv
        ? {
            clear_missing_attestation: octInv.missing_attestation === true,
            resolve_october_sla_alerts: true,
          }
        : {
            clear_missing_attestation: false,
            note: "No October invoice yet — attestation will count when Generate month / ensure creates the invoice (missing_attestation set from attestation presence).",
          },
    });
  }

  const toCopy = plan.filter((p) => p.action !== "skip_existing_october");
  const toSkip = plan.filter((p) => p.action === "skip_existing_october");
  const withOctInvoice = toCopy.filter((p) => p.octoberInvoice);
  const withoutOctInvoice = toCopy.filter((p) => !p.octoberInvoice);
  const regenerate = toCopy.filter((p) => p.action === "copy_db_and_regenerate_pdf");
  const driveCopyOnly = toCopy.filter((p) => p.action === "copy_db_and_drive_file_copy");

  console.log(`November production attestations: ${plan.length}`);
  console.log(`Already have October attestation (skip): ${toSkip.length}`);
  console.log(`Will copy: ${toCopy.length}`);
  console.log(`  - regenerate dated PDF (digital+signature): ${regenerate.length}`);
  console.log(`  - Drive file copy only (upload / no signature): ${driveCopyOnly.length}`);
  console.log(`  - have October invoice (will clear missing_attestation): ${withOctInvoice.length}`);
  console.log(`  - no October invoice yet: ${withoutOctInvoice.length}\n`);

  console.log("--- November sources ---");
  for (const p of plan) {
    console.log(
      `- ${p.clientName} (${p.clientId})  method=${p.captureMethod}  action=${p.action}` +
        (p.octoberInvoice
          ? `  octInvoice=${p.octoberInvoice.id} missing=${p.octoberInvoice.missing_attestation}`
          : "  octInvoice=none")
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifestPath = path.join(
    OUT_DIR,
    `ijp-oct-attestation-copy-manifest-${APPLY ? "apply" : "dry-run"}.json`
  );
  const manifest = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? "apply" : "dry-run",
    sourceMonth: SOURCE_MONTH,
    targetMonth: TARGET_MONTH,
    attestationDateYmd: ATTESTATION_DATE_YMD,
    capturedAtIso: CAPTURED_AT_ISO,
    settings: {
      hasAttestationFolder: Boolean(settings?.drive_attestation_folder_id),
      templateAttestationDocId:
        settings?.template_attestation_doc_id?.trim() || DEFAULT_TEMPLATE_DOC_ID,
    },
    counts: {
      november: plan.length,
      skip: toSkip.length,
      copy: toCopy.length,
      regenerate: regenerate.length,
      driveCopyOnly: driveCopyOnly.length,
      withOctoberInvoice: withOctInvoice.length,
      withoutOctoberInvoice: withoutOctInvoice.length,
    },
    plan,
    applied: [],
  };

  if (!APPLY) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\nWrote dry-run manifest: ${manifestPath}`);
    console.log(
      "\nNo writes performed. To apply later (after Bryan's go-ahead):\n" +
        "  APPLY=1 node scripts/one-off/copy-nov-attestations-to-october.mjs --apply\n"
    );
    return;
  }

  if (!settings?.drive_attestation_folder_id) {
    throw new Error("ijp_billing_settings.drive_attestation_folder_id is missing");
  }

  const { google } = loadGoogleApis();
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  const octFolderId = await ensureMonthFolder(
    drive,
    settings.drive_attestation_folder_id,
    TARGET_MONTH
  );
  const templateDocId =
    settings.template_attestation_doc_id?.trim() || DEFAULT_TEMPLATE_DOC_ID;

  for (const p of toCopy) {
    const source = (novRows ?? []).find((r) => r.id === p.sourceAttestationId);
    if (!source) continue;

    // Re-check idempotency under concurrency.
    const { data: again } = await admin
      .from("ijp_monthly_attestations")
      .select("id")
      .eq("client_id", p.clientId)
      .eq("service_month", TARGET_MONTH)
      .eq("is_test", false)
      .maybeSingle();
    if (again?.id) {
      console.log(`skip (now exists): ${p.clientName}`);
      continue;
    }

    const fileName = `IJP Attestation - ${sanitizeDriveName(p.clientName)} - 2026-10.pdf`;
    let newFile;
    if (p.action === "copy_db_and_regenerate_pdf") {
      const client = clientById.get(p.clientId);
      const octInv = octInvByClient.get(p.clientId);
      const pdfBuffer = await regenerateDigitalAttestationPdf({
        templateDocId,
        clientName: p.clientName,
        facilitatorName: source.facilitator_name || "",
        providerInvoiceNumber: octInv?.provider_invoice_number || "",
        authorizationNumber: (client?.authorization_number || "").trim(),
        signatureDataUrl: source.signature_data_url,
      });
      newFile = await uploadPdfBuffer(drive, octFolderId, fileName, pdfBuffer);
    } else {
      if (!source.attestation_drive_file_id) {
        throw new Error(`Missing Drive file for upload attestation ${p.clientName}`);
      }
      newFile = await copyDriveFileToFolder(
        drive,
        source.attestation_drive_file_id,
        octFolderId,
        fileName
      );
    }

    const { data: inserted, error: insErr } = await admin
      .from("ijp_monthly_attestations")
      .insert({
        client_id: p.clientId,
        service_month: TARGET_MONTH,
        is_test: false,
        attestation_drive_file_id: newFile.fileId,
        attestation_drive_file_name: newFile.fileName,
        captured_by: source.captured_by,
        facilitator_name: source.facilitator_name,
        capture_method: source.capture_method,
        signature_data_url:
          source.capture_method === "digital" ? source.signature_data_url : null,
        captured_at: CAPTURED_AT_ISO,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (insErr) throw new Error(`${p.clientName}: ${insErr.message}`);

    if (p.octoberInvoice?.id) {
      await admin
        .from("ijp_billing_invoices")
        .update({ missing_attestation: false, updated_at: new Date().toISOString() })
        .eq("id", p.octoberInvoice.id)
        .eq("is_test", false);

      await admin
        .from("report_dashboard_alerts")
        .update({ resolved_at: new Date().toISOString() })
        .eq("wayfinder_client_id", p.clientId)
        .eq("reporting_month", TARGET_MONTH)
        .eq("report_type_slug", "ijp_attestation")
        .is("resolved_at", null);
    }

    const appliedRow = {
      clientId: p.clientId,
      clientName: p.clientName,
      newAttestationId: inserted?.id,
      newDriveFileId: newFile.fileId,
      newDriveFileName: newFile.fileName,
      clearedInvoiceId: p.octoberInvoice?.id ?? null,
      pdfStrategy: p.action,
    };
    manifest.applied.push(appliedRow);
    console.log(`applied: ${p.clientName} → attestation ${inserted?.id} file ${newFile.fileId}`);
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nWrote apply manifest (use for rollback): ${manifestPath}`);
  console.log(
    "Rollback: DELETE FROM ijp_monthly_attestations WHERE id IN (...new ids...); trash Drive files by newDriveFileId; optionally set missing_attestation=true again on cleared invoices."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
