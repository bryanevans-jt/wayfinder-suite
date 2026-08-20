import type { SupabaseClient } from "@supabase/supabase-js";

export type EmailTemplateKind = "flat" | "referral_sectional";

export type EmailTemplateKey =
  | "referral_counselor_confirmation"
  | "referral_admin_notice"
  | "intake_appointment_scheduled"
  | "intake_appointment_day_before"
  | "intake_appointment_hour_before"
  | "team_moment_share"
  | "report_vpr_completed"
  | "report_se_monthly_completed"
  | "report_evf_completed"
  | "report_tn_completed"
  | "report_jtsg_vmr_completed"
  | "report_jtsg_tsvs_submitted"
  | "report_tn_upload_submitted"
  | "report_alerts_missing"
  | "report_alerts_overdue";

export type EmailMergeTag = { tag: string; label: string };

export type EmailTemplateDefinition = {
  key: EmailTemplateKey;
  name: string;
  category: string;
  kind: EmailTemplateKind;
  description: string;
  mergeTags: EmailMergeTag[];
  defaults: {
    subject: string;
    body?: string;
    intro?: string;
    closing?: string;
  };
};

export type StoredEmailTemplate = {
  key: string;
  subject: string;
  body: string | null;
  intro: string | null;
  closing: string | null;
  updated_at: string | null;
};

export type ResolvedEmailTemplate = {
  key: EmailTemplateKey;
  kind: EmailTemplateKind;
  subject: string;
  body: string;
  intro?: string;
  closing?: string;
};

const REFERRAL_TAGS: EmailMergeTag[] = [
  { tag: "agency_label", label: "Agency label (GVRA / Tennessee VR)" },
  { tag: "client_name", label: "Client name" },
  { tag: "counselor_name", label: "Counselor name" },
  { tag: "service_name", label: "Service requested" },
];

const INTAKE_TAGS: EmailMergeTag[] = [
  { tag: "client_name", label: "Client name" },
  { tag: "appointment_when", label: "Formatted date & time" },
  { tag: "appointment_location", label: "Location" },
];

const REPORT_TAGS: EmailMergeTag[] = [
  { tag: "client_name", label: "Client name" },
  { tag: "specialist_name", label: "Specialist / submitter name" },
  { tag: "report_name", label: "Report type name" },
];

export const EMAIL_TEMPLATE_CATALOG: EmailTemplateDefinition[] = [
  {
    key: "referral_counselor_confirmation",
    name: "Referral confirmation (counselor)",
    category: "Referrals",
    kind: "referral_sectional",
    description:
      "Sent to the counselor after referral submission. Referral details stay fixed; edit subject, intro, and closing.",
    mergeTags: REFERRAL_TAGS,
    defaults: {
      subject: "Confirmation: Your {{agency_label}} Referral for {{client_name}}",
      intro:
        "Thank you for your referral. Below is a copy of your submission. We will contact you within 2 business days.",
      closing: "— The Joshua Tree",
    },
  },
  {
    key: "referral_admin_notice",
    name: "New referral notice (HR / admin)",
    category: "Referrals",
    kind: "referral_sectional",
    description:
      "Sent to the referral notify inbox (and training CCs). Referral details stay fixed.",
    mergeTags: REFERRAL_TAGS,
    defaults: {
      subject: "New {{agency_label}} Referral - {{counselor_name}} - {{client_name}}",
      intro: "A new {{agency_label}} Client Referral has been submitted.",
      closing: "— The Joshua Tree Wayfinder",
    },
  },
  {
    key: "intake_appointment_scheduled",
    name: "Intake appointment scheduled",
    category: "Intake appointments",
    kind: "flat",
    description: "Sent when Hospitality schedules the intake meeting.",
    mergeTags: INTAKE_TAGS,
    defaults: {
      subject: "Your Joshua Tree intake appointment is scheduled",
      body: [
        "Hello {{client_name}},",
        "",
        "Your intake appointment with The Joshua Tree has been scheduled.",
        "",
        "When: {{appointment_when}}",
        "Where: {{appointment_location}}",
        "",
        "Please arrive a few minutes early. If you need to reschedule, contact us as soon as possible.",
        "",
        "— The Joshua Tree",
      ].join("\n"),
    },
  },
  {
    key: "intake_appointment_day_before",
    name: "Intake reminder (24 hours before)",
    category: "Intake appointments",
    kind: "flat",
    description: "Sent about 24 hours before the intake.",
    mergeTags: INTAKE_TAGS,
    defaults: {
      subject: "Reminder: your Joshua Tree intake is tomorrow",
      body: [
        "Hello {{client_name}},",
        "",
        "This is a reminder that your intake appointment is tomorrow.",
        "",
        "When: {{appointment_when}}",
        "Where: {{appointment_location}}",
        "",
        "We look forward to meeting you.",
        "",
        "— The Joshua Tree",
      ].join("\n"),
    },
  },
  {
    key: "intake_appointment_hour_before",
    name: "Intake reminder (1 hour before)",
    category: "Intake appointments",
    kind: "flat",
    description: "Sent about 1 hour before the intake.",
    mergeTags: INTAKE_TAGS,
    defaults: {
      subject: "Reminder: your Joshua Tree intake is in about an hour",
      body: [
        "Hello {{client_name}},",
        "",
        "Your intake appointment starts in about an hour.",
        "",
        "When: {{appointment_when}}",
        "Where: {{appointment_location}}",
        "",
        "See you soon.",
        "",
        "— The Joshua Tree",
      ].join("\n"),
    },
  },
  {
    key: "team_moment_share",
    name: "Team moment share",
    category: "Team",
    kind: "flat",
    description: "Sent when staff share a team moment to the support inbox.",
    mergeTags: [
      { tag: "client_name", label: "Client name" },
      { tag: "submitted_by", label: "Submitted by" },
      { tag: "submitted_at", label: "Submitted at" },
      { tag: "notes", label: "Notes" },
      { tag: "attachment_summary", label: "Attachment / photo summary" },
    ],
    defaults: {
      subject: "Team moment: {{client_name}}",
      body: [
        "Team moment for {{client_name}}",
        "",
        "Submitted by: {{submitted_by}}",
        "Submitted at: {{submitted_at}}",
        "",
        "Notes:",
        "{{notes}}",
        "",
        "{{attachment_summary}}",
      ].join("\n"),
    },
  },
  {
    key: "report_vpr_completed",
    name: "VPR completed (submitter copy)",
    category: "Reports",
    kind: "flat",
    description: "Email with attached Vocational Progress Report PDF.",
    mergeTags: REPORT_TAGS,
    defaults: {
      subject: "Completed Vocational Progress Report for {{client_name}}",
      body: "Hello,\n\nYour completed Vocational Progress Report for {{client_name}} is attached.\n\nThank you!",
    },
  },
  {
    key: "report_se_monthly_completed",
    name: "SE Monthly completed (submitter copy)",
    category: "Reports",
    kind: "flat",
    description: "Email with attached SE Monthly Report PDF.",
    mergeTags: REPORT_TAGS,
    defaults: {
      subject: "Completed SE Monthly Report for {{client_name}}",
      body: "Hello {{specialist_name}},\n\nYour completed report for {{client_name}} is attached.\n\nThank you!",
    },
  },
  {
    key: "report_evf_completed",
    name: "Employment Verification completed",
    category: "Reports",
    kind: "flat",
    description: "Email with attached Employment Verification Form.",
    mergeTags: REPORT_TAGS,
    defaults: {
      subject: "Completed Employment Verification Form for {{client_name}}",
      body: "Hello,\n\nYour completed Employment Verification Form for {{client_name}} is attached.\n\nThank you!",
    },
  },
  {
    key: "report_tn_completed",
    name: "Tennessee report completed",
    category: "Reports",
    kind: "flat",
    description: "Email when a Tennessee report PDF is completed.",
    mergeTags: REPORT_TAGS,
    defaults: {
      subject: "Completed {{report_name}} for {{client_name}}",
      body: "Hello,\n\nYour completed {{report_name}} for {{client_name}} is attached.\n\nThank you!",
    },
  },
  {
    key: "report_jtsg_vmr_completed",
    name: "JTSG VMR completed",
    category: "Reports",
    kind: "flat",
    description: "Email with attached JTSG Vocational Monthly Report.",
    mergeTags: REPORT_TAGS,
    defaults: {
      subject: "Completed JTSG Vocational Monthly Report for {{client_name}}",
      body: "Hello,\n\nYour completed JTSG Vocational Monthly Report for {{client_name}} is attached.\n\nThank you!",
    },
  },
  {
    key: "report_jtsg_tsvs_submitted",
    name: "JTSG timesheet submitted",
    category: "Reports",
    kind: "flat",
    description: "Email when a JTSG timesheet is submitted.",
    mergeTags: REPORT_TAGS,
    defaults: {
      subject: "JTSG Time Sheet Submitted - {{client_name}}",
      body: "Hello,\n\nA JTSG time sheet for {{client_name}} has been submitted.\n\nThank you!",
    },
  },
  {
    key: "report_tn_upload_submitted",
    name: "Tennessee upload submitted",
    category: "Reports",
    kind: "flat",
    description: "Email when a Tennessee report upload is submitted.",
    mergeTags: REPORT_TAGS,
    defaults: {
      subject: "{{report_name}} Submitted - {{client_name}}",
      body: "Hello,\n\n{{report_name}} for {{client_name}} has been submitted.\n\nThank you!",
    },
  },
  {
    key: "report_alerts_missing",
    name: "Missing reports alert",
    category: "Report alerts",
    kind: "flat",
    description: "Cron alert listing missing GVRA monthly reports.",
    mergeTags: [{ tag: "report_list", label: "Bullet list of missing reports" }],
    defaults: {
      subject: "Missing Reports List",
      body:
        "The following GVRA Monthly Reports are not yet submitted (deadline: 10th at 5:00 PM ET):\n\n{{report_list}}",
    },
  },
  {
    key: "report_alerts_overdue",
    name: "Overdue reports alert",
    category: "Report alerts",
    kind: "flat",
    description: "Cron alert listing overdue GVRA monthly reports.",
    mergeTags: [{ tag: "report_list", label: "Bullet list of overdue reports" }],
    defaults: {
      subject: "Overdue GVRA Monthly Reports",
      body:
        "The following GVRA Monthly Reports are still outstanding (escalated overdue list; GVRA deadline: 10th at 5:00 PM ET):\n\n{{report_list}}",
    },
  },
];

export function getEmailTemplateDefinition(key: string): EmailTemplateDefinition | undefined {
  return EMAIL_TEMPLATE_CATALOG.find((t) => t.key === key);
}

export function isEmailTemplateKey(key: string): key is EmailTemplateKey {
  return EMAIL_TEMPLATE_CATALOG.some((t) => t.key === key);
}

export function applyMergeTags(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, raw: string) => {
    const k = String(raw).toLowerCase();
    return Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : "";
  });
}

export function mergeStoredOverDefaults(
  def: EmailTemplateDefinition,
  stored: StoredEmailTemplate | null | undefined
): ResolvedEmailTemplate {
  if (def.kind === "referral_sectional") {
    return {
      key: def.key,
      kind: def.kind,
      subject: stored?.subject?.trim() || def.defaults.subject,
      intro: stored?.intro?.trim() || def.defaults.intro || "",
      closing: stored?.closing?.trim() || def.defaults.closing || "",
      body: "",
    };
  }
  return {
    key: def.key,
    kind: def.kind,
    subject: stored?.subject?.trim() || def.defaults.subject,
    body: stored?.body?.trim() || def.defaults.body || "",
  };
}

export async function loadStoredEmailTemplates(
  admin: SupabaseClient
): Promise<Map<string, StoredEmailTemplate>> {
  const { data, error } = await admin
    .from("email_templates")
    .select("key, subject, body, intro, closing, updated_at");
  if (error) {
    console.error("email_templates load failed:", error.message);
    return new Map();
  }
  const map = new Map<string, StoredEmailTemplate>();
  for (const row of data ?? []) {
    map.set(String(row.key), row as StoredEmailTemplate);
  }
  return map;
}

export async function loadResolvedEmailTemplate(
  admin: SupabaseClient,
  key: EmailTemplateKey
): Promise<ResolvedEmailTemplate> {
  const def = getEmailTemplateDefinition(key);
  if (!def) throw new Error(`Unknown email template: ${key}`);
  const { data } = await admin
    .from("email_templates")
    .select("key, subject, body, intro, closing, updated_at")
    .eq("key", key)
    .maybeSingle();
  return mergeStoredOverDefaults(def, (data as StoredEmailTemplate | null) ?? null);
}

export function renderFlatEmail(
  resolved: ResolvedEmailTemplate,
  vars: Record<string, string>
): { subject: string; text: string } {
  return {
    subject: applyMergeTags(resolved.subject, vars),
    text: applyMergeTags(resolved.body, vars),
  };
}

export function renderReferralSectionalEmail(
  resolved: ResolvedEmailTemplate,
  opts: { vars: Record<string, string>; detailsBlock: string }
): { subject: string; text: string } {
  const intro = applyMergeTags(resolved.intro || "", opts.vars).trim();
  const closing = applyMergeTags(resolved.closing || "", opts.vars).trim();
  const details = opts.detailsBlock.trim();
  const text = [intro, "", details, "", closing].join("\n").trim() + "\n";
  return {
    subject: applyMergeTags(resolved.subject, opts.vars),
    text,
  };
}

/** Sample merge values for Super Admin test sends / preview. */
export function sampleMergeVarsForTemplate(key: EmailTemplateKey): Record<string, string> {
  const base: Record<string, string> = {
    agency_label: "GVRA",
    client_name: "Jordan Example",
    counselor_name: "Alex Counselor",
    service_name: "Individual Job Placement (GA)",
    appointment_when: "Friday, August 28, 2026 at 10:00 AM",
    appointment_location: "Joshua Tree office — front lobby",
    submitted_by: "Sam Specialist",
    submitted_at: "Aug 20, 2026, 3:00 PM",
    notes: "Celebrating a successful interview this week.",
    attachment_summary: "Photos attached: 2",
    specialist_name: "Sam Specialist",
    report_name: "SE Monthly Report",
    report_list:
      " - Sam Specialist - Jordan Example - Job Development\n - Taylor Specialist - Riley Example - Stabilization",
  };
  void key;
  return base;
}

export async function upsertEmailTemplate(
  admin: SupabaseClient,
  opts: {
    key: EmailTemplateKey;
    subject: string;
    body?: string | null;
    intro?: string | null;
    closing?: string | null;
    updatedBy: string;
  }
): Promise<{ ok: true } | { error: string }> {
  const def = getEmailTemplateDefinition(opts.key);
  if (!def) return { error: "Unknown template" };

  const subject = opts.subject.trim();
  if (!subject) return { error: "Subject is required" };

  const row: Record<string, unknown> = {
    key: opts.key,
    subject,
    updated_at: new Date().toISOString(),
    updated_by: opts.updatedBy,
  };

  if (def.kind === "referral_sectional") {
    const intro = (opts.intro ?? "").trim();
    const closing = (opts.closing ?? "").trim();
    if (!intro) return { error: "Intro is required" };
    if (!closing) return { error: "Closing is required" };
    row.intro = intro;
    row.closing = closing;
    row.body = null;
  } else {
    const body = (opts.body ?? "").trim();
    if (!body) return { error: "Body is required" };
    row.body = body;
    row.intro = null;
    row.closing = null;
  }

  const { error } = await admin.from("email_templates").upsert(row, { onConflict: "key" });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function resetEmailTemplate(
  admin: SupabaseClient,
  key: EmailTemplateKey
): Promise<{ ok: true } | { error: string }> {
  const { error } = await admin.from("email_templates").delete().eq("key", key);
  if (error) return { error: error.message };
  return { ok: true };
}
