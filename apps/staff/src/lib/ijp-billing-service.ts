import { Readable } from "stream";
import { google } from "googleapis";
import { clientDisplayName } from "@wayfinder/branding";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IjpBillingSettingsRow } from "@wayfinder/supabase/ijp-billing-settings";
import {
  buildIjpAttestationPlaceholders,
  buildIjpInvoiceHeaderPlaceholders,
  buildIjpInvoiceLineItems,
  recalcLineAmount,
  sumIjpLineItems,
  type IjpInvoiceLineItem,
} from "@wayfinder/supabase/ijp-billing-lines";
import {
  serviceMonthLabel,
  serviceMonthEndYmd,
} from "@wayfinder/supabase/ijp-billing-eligibility";
import { getGoogleAuth } from "@/lib/google-mail";
import { sanitizeDriveName, uploadPreEtsFileToDrive } from "@/lib/pre-ets-drive";
import {
  exportIjpAttestationPdf,
  exportIjpInvoicePdf,
  mergePdfBuffers,
} from "@/lib/ijp-billing-doc-pdf";
import { loadStaffNameById } from "@/lib/staff-names";
import { localDateStringInTz, STAFF_CLOCK_TIMEZONE } from "@wayfinder/supabase/staff-time-clock-shared";

function monthFolderSegments(monthStart: string): { year: string; monthKey: string } {
  const [y, m] = monthStart.split("-");
  return { year: y, monthKey: `${y}-${m}` };
}

async function resolveLeafFolder(rootId: string, monthStart: string): Promise<string> {
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  const { year, monthKey } = monthFolderSegments(monthStart);

  async function ensure(parent: string, name: string): Promise<string> {
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

export function driveFoldersForRun(
  settings: IjpBillingSettingsRow,
  isTest: boolean
): { attestationRoot: string | null; invoiceRoot: string | null } {
  if (isTest) {
    return {
      attestationRoot: settings.drive_test_attestation_folder_id,
      invoiceRoot: settings.drive_test_invoice_folder_id,
    };
  }
  return {
    attestationRoot: settings.drive_attestation_folder_id,
    invoiceRoot: settings.drive_invoice_folder_id,
  };
}

function formatInvoiceDateLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function loadClientAuthNumber(admin: SupabaseClient, clientId: string): Promise<string> {
  const { data } = await admin
    .from("clients")
    .select("authorization_number, full_name, contact_email, id")
    .eq("id", clientId)
    .maybeSingle();
  return ((data?.authorization_number as string) ?? "").trim();
}

export async function ensureIjpInvoiceRow(
  admin: SupabaseClient,
  opts: {
    clientId: string;
    serviceMonth: string;
    isTest: boolean;
    settings: IjpBillingSettingsRow;
  }
): Promise<{ id: string; line_items: IjpInvoiceLineItem[] }> {
  const authNumber = await loadClientAuthNumber(admin, opts.clientId);
  const { data: existing } = await admin
    .from("ijp_billing_invoices")
    .select("id, line_items")
    .eq("client_id", opts.clientId)
    .eq("service_month", opts.serviceMonth)
    .eq("is_test", opts.isTest)
    .maybeSingle();

  if (existing?.id) {
    return {
      id: existing.id as string,
      line_items: (existing.line_items as IjpInvoiceLineItem[]) ?? [],
    };
  }

  const { data: client } = await admin
    .from("clients")
    .select("es_user_id")
    .eq("id", opts.clientId)
    .maybeSingle();
  const esIds = new Set<string>();
  if (client?.es_user_id) esIds.add(client.es_user_id as string);

  const { data: entries } = await admin
    .from("es_time_entries")
    .select("es_user_id")
    .eq("client_id", opts.clientId)
    .gte("service_date", opts.serviceMonth)
    .lte("service_date", serviceMonthEndYmd(opts.serviceMonth));
  for (const e of entries ?? []) {
    if (e.es_user_id) esIds.add(e.es_user_id as string);
  }

  const esNameByUserId = await loadStaffNameById(admin, [...esIds], "ES");
  const lines = await buildIjpInvoiceLineItems(admin, {
    clientId: opts.clientId,
    monthStart: opts.serviceMonth,
    authorizationNumber: authNumber,
    hourlyRateCents: opts.settings.hourly_rate_cents,
    esNameByUserId,
  });
  const totals = sumIjpLineItems(lines);

  const { data: inserted, error } = await admin
    .from("ijp_billing_invoices")
    .insert({
      client_id: opts.clientId,
      service_month: opts.serviceMonth,
      is_test: opts.isTest,
      authorization_number: authNumber || null,
      line_items: lines,
      total_hours: totals.totalHours,
      total_amount_cents: totals.totalAmountCents,
      missing_attestation: true,
    })
    .select("id, line_items")
    .maybeSingle();

  if (error || !inserted?.id) {
    throw new Error(error?.message ?? "Could not create IJP invoice row.");
  }

  return {
    id: inserted.id as string,
    line_items: (inserted.line_items as IjpInvoiceLineItem[]) ?? lines,
  };
}

export async function compileIjpInvoicePdf(
  admin: SupabaseClient,
  invoiceId: string,
  settings: IjpBillingSettingsRow
): Promise<{ invoiceOnlyFileId: string; fileName: string }> {
  const { data: invoice } = await admin
    .from("ijp_billing_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) throw new Error("Invoice not found.");

  const isTest = invoice.is_test as boolean;
  const folders = driveFoldersForRun(settings, isTest);
  if (!folders.invoiceRoot) {
    throw new Error("Invoice Drive folder is not configured.");
  }

  const { data: client } = await admin
    .from("clients")
    .select("full_name, contact_email, id")
    .eq("id", invoice.client_id)
    .maybeSingle();
  const name = clientDisplayName(client ?? { id: invoice.client_id as string });

  const monthStart = invoice.service_month as string;
  const invoiceDate =
    (invoice.invoice_date as string) ??
    localDateStringInTz(new Date(), STAFF_CLOCK_TIMEZONE);

  const lines = ((invoice.line_items as IjpInvoiceLineItem[]) ?? []).map((line) =>
    recalcLineAmount(line, settings.hourly_rate_cents)
  );
  const totals = sumIjpLineItems(lines);
  const instructors = [...new Set(lines.map((l) => l.instructorName).filter(Boolean))].join(", ");

  const templateId =
    settings.template_invoice_doc_id?.trim() || "1mm4mg-6usruEv6E6lZEV6Y3o0IuuKw_rACaoXX08G-g";

  const pdf = await exportIjpInvoicePdf({
    templateDocId: templateId,
    tempName: `IJP Invoice ${name} ${monthStart}`,
    headerPlaceholders: buildIjpInvoiceHeaderPlaceholders({
      invoiceDate: formatInvoiceDateLabel(invoiceDate),
      providerName: settings.provider_name,
      remitAddress: settings.remit_address,
      providerInvoiceNumber: (invoice.provider_invoice_number as string) ?? "",
      authorizationNumber: (invoice.authorization_number as string) ?? "",
      clientName: name,
      serviceMonth: monthStart,
      serviceMonthLabel: serviceMonthLabel(monthStart),
      hourlyRateCents: settings.hourly_rate_cents,
      totalHours: totals.totalHours,
      totalAmountCents: totals.totalAmountCents,
      instructorFacilitatorSummary: instructors,
    }),
    lines,
    signatureFolderId: settings.drive_signature_temp_folder_id,
  });

  const folderId = await resolveLeafFolder(folders.invoiceRoot, monthStart);
  const fileName = `${sanitizeDriveName(name)} - IJP Invoice - ${monthFolderSegments(monthStart).monthKey}.pdf`;
  const uploaded = await uploadPreEtsFileToDrive({
    folderId,
    fileName,
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf),
  });

  await admin
    .from("ijp_billing_invoices")
    .update({
      line_items: lines,
      total_hours: totals.totalHours,
      total_amount_cents: totals.totalAmountCents,
      invoice_date: invoiceDate,
      invoice_only_drive_file_id: uploaded.fileId,
      compiled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  return { invoiceOnlyFileId: uploaded.fileId, fileName: uploaded.fileName };
}

export async function regenerateIjpAttestationPdfIfStored(
  admin: SupabaseClient,
  opts: {
    clientId: string;
    serviceMonth: string;
    isTest: boolean;
    settings: IjpBillingSettingsRow;
    facilitatorName: string;
  }
): Promise<boolean> {
  const { data: att } = await admin
    .from("ijp_monthly_attestations")
    .select("capture_method, signature_data_url, captured_by")
    .eq("client_id", opts.clientId)
    .eq("service_month", opts.serviceMonth)
    .eq("is_test", opts.isTest)
    .maybeSingle();

  if (!att || att.capture_method !== "digital" || !att.signature_data_url || !att.captured_by) {
    return false;
  }

  await saveIjpAttestation(admin, {
    clientId: opts.clientId,
    serviceMonth: opts.serviceMonth,
    isTest: opts.isTest,
    settings: opts.settings,
    signatureDataUrl: att.signature_data_url as string,
    capturedBy: att.captured_by as string,
    facilitatorName: opts.facilitatorName,
    captureMethod: "digital",
    skipResolveAlerts: true,
  });
  return true;
}

export async function saveIjpAttestation(
  admin: SupabaseClient,
  opts: {
    clientId: string;
    serviceMonth: string;
    isTest: boolean;
    settings: IjpBillingSettingsRow;
    signatureDataUrl?: string | null;
    uploadPdfBase64?: string | null;
    uploadImageBase64?: string | null;
    uploadMimeType?: string | null;
    capturedBy: string;
    facilitatorName: string;
    captureMethod: "digital" | "upload";
    skipResolveAlerts?: boolean;
  }
): Promise<{ attestationFileId: string; fileName: string }> {
  const folders = driveFoldersForRun(settings, opts.isTest);
  if (!folders.attestationRoot) {
    throw new Error("Attestation Drive folder is not configured.");
  }

  const authNumber = await loadClientAuthNumber(admin, opts.clientId);
  const { data: client } = await admin
    .from("clients")
    .select("full_name, contact_email, id")
    .eq("id", opts.clientId)
    .maybeSingle();
  const name = clientDisplayName(client ?? { id: opts.clientId });

  const { data: invoice } = await admin
    .from("ijp_billing_invoices")
    .select("provider_invoice_number, invoice_date")
    .eq("client_id", opts.clientId)
    .eq("service_month", opts.serviceMonth)
    .eq("is_test", opts.isTest)
    .maybeSingle();

  const invoiceDate =
    (invoice?.invoice_date as string) ??
    localDateStringInTz(new Date(), STAFF_CLOCK_TIMEZONE);

  const attestationTemplateId =
    settings.template_attestation_doc_id?.trim() ||
    "1r8ekYATmXRbfAxNOQJd_sWJwbprUU9A17Gou7fKvVHE";

  let pdf: Uint8Array;
  if (opts.uploadPdfBase64 || opts.uploadImageBase64) {
    const { decodeUploadPayload } = await import("@/lib/ijp-image-pdf");
    pdf = await decodeUploadPayload({
      uploadPdfBase64: opts.uploadPdfBase64,
      uploadImageBase64: opts.uploadImageBase64,
      uploadMimeType: opts.uploadMimeType,
    });
  } else {
    pdf = await exportIjpAttestationPdf({
      templateDocId: attestationTemplateId,
      tempName: `IJP Attestation ${name} ${opts.serviceMonth}`,
      placeholders: buildIjpAttestationPlaceholders({
        attestationProviderName: opts.facilitatorName,
        providerInvoiceNumber: (invoice?.provider_invoice_number as string) ?? "",
        authorizationNumber: authNumber,
        attestationDate: formatInvoiceDateLabel(invoiceDate),
      }),
      signatureDataUrl: opts.signatureDataUrl,
      signatureFolderId: settings.drive_signature_temp_folder_id,
    });
  }

  const folderId = await resolveLeafFolder(folders.attestationRoot, opts.serviceMonth);
  const fileName = `IJP Attestation - ${sanitizeDriveName(name)} - ${monthFolderSegments(opts.serviceMonth).monthKey}.pdf`;
  const uploaded = await uploadPreEtsFileToDrive({
    folderId,
    fileName,
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf),
  });

  await admin.from("ijp_monthly_attestations").upsert(
    {
      client_id: opts.clientId,
      service_month: opts.serviceMonth,
      is_test: opts.isTest,
      attestation_drive_file_id: uploaded.fileId,
      attestation_drive_file_name: uploaded.fileName,
      captured_by: opts.capturedBy,
      facilitator_name: opts.facilitatorName,
      capture_method: opts.captureMethod,
      signature_data_url:
        opts.captureMethod === "digital" && opts.signatureDataUrl ? opts.signatureDataUrl : null,
      captured_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,service_month,is_test" }
  );

  if (!opts.isTest && !opts.skipResolveAlerts) {
    await admin
      .from("ijp_billing_invoices")
      .update({ missing_attestation: false, updated_at: new Date().toISOString() })
      .eq("client_id", opts.clientId)
      .eq("service_month", opts.serviceMonth)
      .eq("is_test", false);

    await admin
      .from("report_dashboard_alerts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("wayfinder_client_id", opts.clientId)
      .eq("reporting_month", opts.serviceMonth)
      .eq("report_type_slug", "ijp_attestation")
      .is("resolved_at", null);
  }

  return { attestationFileId: uploaded.fileId, fileName: uploaded.fileName };
}

export async function archiveCombinedIjpPacket(
  admin: SupabaseClient,
  invoiceId: string,
  settings: IjpBillingSettingsRow
): Promise<{ combinedFileId: string }> {
  const { data: invoice } = await admin
    .from("ijp_billing_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) throw new Error("Invoice not found.");

  const isTest = invoice.is_test as boolean;
  const monthStart = invoice.service_month as string;

  let invoicePdf: Uint8Array | null = null;
  if (invoice.invoice_only_drive_file_id) {
    const auth = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const res = await drive.files.get(
      {
        supportsAllDrives: true,
        fileId: invoice.invoice_only_drive_file_id as string,
        alt: "media",
      },
      { responseType: "arraybuffer" }
    );
    invoicePdf = new Uint8Array(res.data as ArrayBuffer);
  } else {
    const compiled = await compileIjpInvoicePdf(admin, invoiceId, settings);
    const auth = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const res = await drive.files.get(
      { supportsAllDrives: true, fileId: compiled.invoiceOnlyFileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    invoicePdf = new Uint8Array(res.data as ArrayBuffer);
  }

  const { data: att } = await admin
    .from("ijp_monthly_attestations")
    .select("attestation_drive_file_id")
    .eq("client_id", invoice.client_id)
    .eq("service_month", monthStart)
    .eq("is_test", isTest)
    .maybeSingle();

  let combined = invoicePdf;
  if (att?.attestation_drive_file_id) {
    const auth = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const res = await drive.files.get(
      {
        supportsAllDrives: true,
        fileId: att.attestation_drive_file_id as string,
        alt: "media",
      },
      { responseType: "arraybuffer" }
    );
    const attPdf = new Uint8Array(res.data as ArrayBuffer);
    combined = await mergePdfBuffers(invoicePdf, attPdf);
  }

  const folders = driveFoldersForRun(settings, isTest);
  if (!folders.invoiceRoot) throw new Error("Invoice Drive folder is not configured.");

  const { data: client } = await admin
    .from("clients")
    .select("full_name, contact_email, id")
    .eq("id", invoice.client_id)
    .maybeSingle();
  const name = clientDisplayName(client ?? { id: invoice.client_id as string });

  const folderId = await resolveLeafFolder(folders.invoiceRoot, monthStart);
  const fileName = `${sanitizeDriveName(name)} - IJP Invoice - ${monthFolderSegments(monthStart).monthKey}.pdf`;
  const uploaded = await uploadPreEtsFileToDrive({
    folderId,
    fileName,
    mimeType: "application/pdf",
    buffer: Buffer.from(combined),
  });

  await admin
    .from("ijp_billing_invoices")
    .update({
      status: "archived",
      combined_drive_file_id: uploaded.fileId,
      archived_at: new Date().toISOString(),
      missing_attestation: !att?.attestation_drive_file_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  return { combinedFileId: uploaded.fileId };
}
