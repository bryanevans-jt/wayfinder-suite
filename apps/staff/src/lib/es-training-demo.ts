import { createClientAccount } from "@wayfinder/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const TRAINING_ES_EMAIL = "es-training-demo@demo.wayfinder.local";
const CONFIG_ROW_ID = "00000000-0000-4000-8000-000000000001";

const TRAINING_CLIENT_NAMES = [
  "Jordan Reese",
  "Alex Morgan",
  "Casey Brooks",
  "Riley Chen",
  "Taylor Nguyen",
  "Morgan Patel",
  "Jamie Ortiz",
  "Quinn Washington",
];

type TrainingDemoConfig = {
  trainingEsUserId: string;
};

async function loadTrainingConfig(admin: SupabaseClient): Promise<TrainingDemoConfig | null> {
  const { data } = await admin
    .from("admin_config")
    .select("es_training_demo")
    .limit(1)
    .maybeSingle();
  const raw = data?.es_training_demo as TrainingDemoConfig | null;
  if (raw?.trainingEsUserId) return raw;
  return null;
}

async function saveTrainingConfig(admin: SupabaseClient, config: TrainingDemoConfig): Promise<void> {
  const { data: row } = await admin.from("admin_config").select("id").limit(1).maybeSingle();
  if (row?.id) {
    await admin.from("admin_config").update({ es_training_demo: config }).eq("id", row.id);
    return;
  }
  await admin.from("admin_config").insert({
    id: CONFIG_ROW_ID,
    es_training_demo: config,
  });
}

async function ensureTrainingEsUser(admin: SupabaseClient): Promise<string> {
  const existing = await loadTrainingConfig(admin);
  if (existing?.trainingEsUserId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, is_active, role")
      .eq("id", existing.trainingEsUserId)
      .maybeSingle();
    if (profile?.is_active && profile.role === "es") {
      return existing.trainingEsUserId;
    }
  }

  const { data: byEmail } = await admin
    .from("profiles")
    .select("id, role, is_active")
    .eq("email", TRAINING_ES_EMAIL)
    .maybeSingle();
  if (byEmail?.id && byEmail.role === "es" && byEmail.is_active) {
    await saveTrainingConfig(admin, { trainingEsUserId: byEmail.id as string });
    return byEmail.id as string;
  }

  const password = `WfTrain-${crypto.randomUUID().slice(0, 12)}!`;
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: TRAINING_ES_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: "ES Training Demo" },
  });
  if (authErr || !authUser.user?.id) {
    throw new Error(authErr?.message ?? "Could not create training ES login.");
  }

  const userId = authUser.user.id;
  await admin.from("profiles").upsert({
    id: userId,
    email: TRAINING_ES_EMAIL,
    role: "es",
    is_active: true,
    full_name: "ES Training Demo",
    display_name: "ES Training Demo",
  });

  await saveTrainingConfig(admin, { trainingEsUserId: userId });
  return userId;
}

type SampleClientShape = {
  current_service_id: string | null;
  current_stage_id: string | null;
  office_id: string | null;
};

export async function ensureEsTrainingDemoCaseload(
  admin: SupabaseClient,
  createdBy: string
): Promise<{ trainingEsUserId: string; demoClientIds: string[] }> {
  const trainingEsUserId = await ensureTrainingEsUser(admin);

  const { data: assignmentRows } = await admin
    .from("es_client_assignments")
    .select("client_id")
    .eq("es_user_id", trainingEsUserId);
  const assignedIds = (assignmentRows ?? []).map((r) => r.client_id as string);
  const { data: demoRows } = assignedIds.length
    ? await admin.from("clients").select("id").in("id", assignedIds).eq("is_demo", true)
    : { data: [] as { id: string }[] };
  const existingIds = (demoRows ?? []).map((r) => r.id as string);

  const targetCount = 6;
  if (existingIds.length >= targetCount) {
    return { trainingEsUserId, demoClientIds: existingIds };
  }

  const { data: samples } = await admin
    .from("clients")
    .select("current_service_id, current_stage_id, office_id")
    .eq("is_demo", false)
    .not("current_service_id", "is", null)
    .not("office_id", "is", null)
    .limit(40);

  const shapes = (samples ?? []) as SampleClientShape[];
  if (shapes.length === 0) {
    throw new Error("No sample clients available to seed training demo shapes.");
  }

  const { data: offices } = await admin.from("offices").select("id").limit(1);
  const { data: services } = await admin.from("services").select("id").limit(1);
  const fallbackOffice = offices?.[0]?.id as string | undefined;
  const fallbackService = services?.[0]?.id as string | undefined;

  const demoClientIds = [...existingIds];
  let nameIdx = 0;

  while (demoClientIds.length < targetCount) {
    const shape = shapes[demoClientIds.length % shapes.length]!;
    const officeId = shape.office_id ?? fallbackOffice;
    const serviceId = shape.current_service_id ?? fallbackService;
    if (!officeId || !serviceId) break;

    const displayName = TRAINING_CLIENT_NAMES[nameIdx % TRAINING_CLIENT_NAMES.length]!;
    nameIdx += 1;
    const email = `training.${Date.now().toString(36)}.${demoClientIds.length}@demo.wayfinder.local`;

    const { data: officeCounselor } = await admin
      .from("counselors")
      .select("id")
      .eq("office_id", officeId)
      .limit(1)
      .maybeSingle();
    if (!officeCounselor?.id) {
      throw new Error("No counselor found for training demo office.");
    }

    const result = await createClientAccount(admin, {
      name: displayName,
      email,
      serviceId,
      officeId,
      counselorId: officeCounselor.id as string,
      esUserId: trainingEsUserId,
      sendInvite: false,
    });

    if ("error" in result) {
      throw new Error(result.error);
    }

    await admin
      .from("clients")
      .update({
        is_demo: true,
        demo_created_by: createdBy,
        counselor_id: null,
        current_stage_id: shape.current_stage_id,
      })
      .eq("id", result.clientId);

    demoClientIds.push(result.clientId);
  }

  return { trainingEsUserId, demoClientIds };
}

export async function resolveTrainingEsUserId(admin: SupabaseClient): Promise<string | null> {
  const config = await loadTrainingConfig(admin);
  return config?.trainingEsUserId ?? null;
}
