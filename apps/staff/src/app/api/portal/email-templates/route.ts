import { getGoogleAuth, sendEmail } from "@/lib/google-mail";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  EMAIL_TEMPLATE_CATALOG,
  getEmailTemplateDefinition,
  isEmailTemplateKey,
  loadStoredEmailTemplates,
  mergeStoredOverDefaults,
  renderFlatEmail,
  renderReferralSectionalEmail,
  resetEmailTemplate,
  sampleMergeVarsForTemplate,
  upsertEmailTemplate,
} from "@wayfinder/supabase/email-templates";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { buildReferralDetailsBlock } from "@wayfinder/supabase/referral-intake";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const stored = await loadStoredEmailTemplates(admin);
  const templates = EMAIL_TEMPLATE_CATALOG.map((def) => {
    const resolved = mergeStoredOverDefaults(def, stored.get(def.key) ?? null);
    const row = stored.get(def.key);
    return {
      key: def.key,
      name: def.name,
      category: def.category,
      kind: def.kind,
      description: def.description,
      mergeTags: def.mergeTags,
      defaults: def.defaults,
      subject: resolved.subject,
      body: resolved.body,
      intro: resolved.intro ?? "",
      closing: resolved.closing ?? "",
      isCustomized: Boolean(row),
      updatedAt: row?.updated_at ?? null,
    };
  });

  return NextResponse.json({ templates });
}

export async function PATCH(request: Request) {
  await assertNotPreviewMutation();
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    key?: string;
    subject?: string;
    body?: string;
    intro?: string;
    closing?: string;
    reset?: boolean;
  };

  if (!body.key || !isEmailTemplateKey(body.key)) {
    return NextResponse.json({ error: "Invalid template key" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (body.reset) {
    const result = await resetEmailTemplate(admin, body.key);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, reset: true });
  }

  const result = await upsertEmailTemplate(admin, {
    key: body.key,
    subject: body.subject ?? "",
    body: body.body,
    intro: body.intro,
    closing: body.closing,
    updatedBy: session.effectiveUserId,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  await assertNotPreviewMutation();
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    key?: string;
    subject?: string;
    bodyText?: string;
    intro?: string;
    closing?: string;
  };

  if (!body.key || !isEmailTemplateKey(body.key)) {
    return NextResponse.json({ error: "Invalid template key" }, { status: 400 });
  }

  const def = getEmailTemplateDefinition(body.key);
  if (!def) {
    return NextResponse.json({ error: "Unknown template" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: userData } = await admin.auth.admin.getUserById(session.effectiveUserId);
  const destination = userData.user?.email?.trim() || null;
  if (!destination) {
    return NextResponse.json(
      { error: "Could not find an email address for your account." },
      { status: 400 }
    );
  }

  const vars = sampleMergeVarsForTemplate(body.key);
  let subject = (body.subject ?? "").trim() || def.defaults.subject;
  let text = "";

  if (def.kind === "referral_sectional") {
    const details = buildReferralDetailsBlock({
      payload: {
        counselorName: vars.counselor_name,
        counselorEmail: "counselor@example.com",
        counselorPhone: "(555) 555-0100",
        service: vars.service_name,
        clientName: vars.client_name,
        dob: "2000-01-15",
        clientPhone: "(555) 555-0101",
        clientPhone2: "",
        clientAddress: "123 Example St",
        clientEmail: "client@example.com",
        gender: "",
        ethnicity: "",
        disability: "Example disability notes",
        workGoal: "Retail employment",
        meetingOption: "In person",
        counselorAvailability: "Afternoons",
      },
      serviceName: vars.service_name,
      authFileName: "authorization.pdf",
      otherFileName: "None",
    });
    const rendered = renderReferralSectionalEmail(
      {
        key: body.key,
        kind: "referral_sectional",
        subject,
        body: "",
        intro: (body.intro ?? "").trim() || def.defaults.intro || "",
        closing: (body.closing ?? "").trim() || def.defaults.closing || "",
      },
      { vars, detailsBlock: details }
    );
    subject = rendered.subject;
    text = rendered.text;
  } else {
    const rendered = renderFlatEmail(
      {
        key: body.key,
        kind: "flat",
        subject,
        body: (body.bodyText ?? "").trim() || def.defaults.body || "",
      },
      vars
    );
    subject = rendered.subject;
    text = rendered.text;
  }

  try {
    const gauth = await getGoogleAuth();
    await sendEmail(gauth, {
      to: destination,
      subject: `[TEST] ${subject}`,
      text: `This is a test send from Wayfinder Super Admin → Email Templates.\n\n${text}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, to: destination });
}
