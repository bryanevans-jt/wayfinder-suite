import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessReportAdmin } from "@/lib/report-access";
import { NextResponse } from "next/server";

export type TnReportTypeRow = {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  requiresSignature: boolean;
  counselorAllowed: boolean;
  templateKind: string;
  googleDocTemplateId: string | null;
  blankPdfFileId: string | null;
  driveFolderId: string | null;
  tagSchema: unknown;
  sortOrder: number;
};

export type TnProgramRow = {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  sortOrder: number;
  reportTypes: TnReportTypeRow[];
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email?.endsWith("@thejoshuatree.org")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!(await canAccessReportAdmin(supabase, user.id))) {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return { user };
}

function mapReportType(row: Record<string, unknown>): TnReportTypeRow {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    enabled: Boolean(row.enabled),
    requiresSignature: Boolean(row.requires_signature),
    counselorAllowed: Boolean(row.counselor_allowed),
    templateKind: (row.template_kind as string) ?? "google_doc",
    googleDocTemplateId: (row.google_doc_template_id as string | null) ?? null,
    blankPdfFileId: (row.blank_pdf_file_id as string | null) ?? null,
    driveFolderId: (row.drive_folder_id as string | null) ?? null,
    tagSchema: row.tag_schema ?? [],
    sortOrder: (row.sort_order as number) ?? 0,
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const admin = createAdminClient();
  const [{ data: programs, error: programError }, { data: reportTypes, error: typeError }] =
    await Promise.all([
      admin
        .from("report_service_programs")
        .select("id, name, slug, enabled, sort_order")
        .eq("state", "TN")
        .order("sort_order"),
      admin
        .from("report_type_definitions")
        .select("*")
        .eq("state", "TN")
        .order("sort_order"),
    ]);

  if (programError) {
    return NextResponse.json({ error: programError.message }, { status: 500 });
  }
  if (typeError) {
    return NextResponse.json({ error: typeError.message }, { status: 500 });
  }

  const typesByProgram = new Map<string, TnReportTypeRow[]>();
  for (const row of reportTypes ?? []) {
    const programId = row.program_id as string | null;
    if (!programId) continue;
    const list = typesByProgram.get(programId) ?? [];
    list.push(mapReportType(row as Record<string, unknown>));
    typesByProgram.set(programId, list);
  }

  const catalog: TnProgramRow[] = (programs ?? []).map((program) => ({
    id: program.id as string,
    name: program.name as string,
    slug: program.slug as string,
    enabled: Boolean(program.enabled),
    sortOrder: (program.sort_order as number) ?? 0,
    reportTypes: typesByProgram.get(program.id as string) ?? [],
  }));

  return NextResponse.json({ programs: catalog });
}

type ProgramPatch = {
  id: string;
  enabled?: boolean;
  name?: string;
  sortOrder?: number;
};

type ReportTypePatch = {
  id: string;
  enabled?: boolean;
  name?: string;
  slug?: string;
  requiresSignature?: boolean;
  counselorAllowed?: boolean;
  templateKind?: string;
  googleDocTemplateId?: string | null;
  blankPdfFileId?: string | null;
  driveFolderId?: string | null;
  tagSchema?: unknown;
  sortOrder?: number;
  programId?: string | null;
};

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const body = (await request.json()) as {
    programs?: ProgramPatch[];
    reportTypes?: ReportTypePatch[];
    newReportType?: ReportTypePatch & { programId: string; slug: string; name: string };
  };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  for (const program of body.programs ?? []) {
    const updates: Record<string, unknown> = { updated_at: now };
    if (typeof program.enabled === "boolean") updates.enabled = program.enabled;
    if (program.name) updates.name = program.name;
    if (typeof program.sortOrder === "number") updates.sort_order = program.sortOrder;

    const { error } = await admin
      .from("report_service_programs")
      .update(updates)
      .eq("id", program.id)
      .eq("state", "TN");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  for (const reportType of body.reportTypes ?? []) {
    const updates: Record<string, unknown> = { updated_at: now };
    if (typeof reportType.enabled === "boolean") updates.enabled = reportType.enabled;
    if (reportType.name) updates.name = reportType.name;
    if (reportType.slug) updates.slug = reportType.slug;
    if (typeof reportType.requiresSignature === "boolean") {
      updates.requires_signature = reportType.requiresSignature;
    }
    if (typeof reportType.counselorAllowed === "boolean") {
      updates.counselor_allowed = reportType.counselorAllowed;
    }
    if (reportType.templateKind) updates.template_kind = reportType.templateKind;
    if (reportType.googleDocTemplateId !== undefined) {
      updates.google_doc_template_id = reportType.googleDocTemplateId;
    }
    if (reportType.blankPdfFileId !== undefined) {
      updates.blank_pdf_file_id = reportType.blankPdfFileId;
    }
    if (reportType.driveFolderId !== undefined) {
      updates.drive_folder_id = reportType.driveFolderId;
    }
    if (reportType.tagSchema !== undefined) updates.tag_schema = reportType.tagSchema;
    if (typeof reportType.sortOrder === "number") updates.sort_order = reportType.sortOrder;
    if (reportType.programId !== undefined) updates.program_id = reportType.programId;

    const { error } = await admin
      .from("report_type_definitions")
      .update(updates)
      .eq("id", reportType.id)
      .eq("state", "TN");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (body.newReportType?.programId && body.newReportType.slug && body.newReportType.name) {
    const rt = body.newReportType;
    const { error } = await admin.from("report_type_definitions").insert({
      program_id: rt.programId,
      state: "TN",
      slug: rt.slug,
      name: rt.name,
      enabled: rt.enabled ?? false,
      requires_signature: rt.requiresSignature ?? false,
      counselor_allowed: rt.counselorAllowed ?? false,
      template_kind: rt.templateKind ?? "google_doc",
      google_doc_template_id: rt.googleDocTemplateId ?? null,
      blank_pdf_file_id: rt.blankPdfFileId ?? null,
      drive_folder_id: rt.driveFolderId ?? null,
      tag_schema: rt.tagSchema ?? [],
      sort_order: rt.sortOrder ?? 0,
      updated_at: now,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
