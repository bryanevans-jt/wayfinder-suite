/**
 * One-time / ops repair: mark unbilled referral intakes ready after casework contact logs.
 * Run: node scripts/repair-intake-billing-ready.mjs
 */
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(p) {
  try {
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
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
    /* missing */
  }
}

loadEnv(".env.local");
loadEnv("apps/staff/.env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase URL or service role key");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const FORCE_IDS = [
  "c911a146-9bd5-436e-91ea-b76737887a2d", // James Stephens
  "7a38447a-a190-49f4-bfea-1dd59a2fab2c", // Gabriel Davenport
  "dd31d196-083e-4bc1-9c4f-a5ff4d9bc8c3", // Damion Victrum
];

async function hospitalitySpecialistUserIds() {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "hospitality_specialist");
  return new Set((data ?? []).map((r) => r.id));
}

async function hasNonHospitalityContactLog(clientId) {
  const { data: logs } = await admin
    .from("contact_logs")
    .select("logged_by")
    .eq("client_id", clientId)
    .limit(100);
  if (!logs?.length) return false;
  const hosp = await hospitalitySpecialistUserIds();
  return logs.some((row) => {
    if (!row.logged_by) return true;
    return !hosp.has(row.logged_by);
  });
}

async function clientLabel(clientId) {
  const { data } = await admin
    .from("clients")
    .select("full_name, contact_email, user_id, profile_id")
    .eq("id", clientId)
    .maybeSingle();
  const roster = (data?.full_name || "").trim();
  if (roster) return roster;
  const authId = data?.user_id || data?.profile_id;
  if (authId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", authId)
      .maybeSingle();
    const name = (profile?.full_name || "").trim();
    if (name) return name;
  }
  return (data?.contact_email || "").trim() || "Client";
}

async function notifyAccountsReady(clientId) {
  const label = await clientLabel(clientId);
  const { data: accountants } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "accountant")
    .eq("is_active", true);
  for (const row of accountants ?? []) {
    await admin.from("in_app_notifications").insert({
      user_id: row.id,
      kind: "referral_intake_billing",
      title: `Bill intake: ${label}`,
      body: "Intake meeting is complete. Bill the state, then mark payment received.",
      link_path: "/dashboard/intake-billing",
      metadata: { clientId },
    });
  }
}

async function markReady(clientId, { force = false } = {}) {
  const { data: client } = await admin
    .from("clients")
    .select("id, full_name, referred_at, authorization_number, created_at")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) {
    console.log("skip missing", clientId);
    return { ready: false };
  }

  // Damion: missing roster name / referred_at — repair enough to show in billing.
  if (clientId === "dd31d196-083e-4bc1-9c4f-a5ff4d9bc8c3") {
    const patch = {};
    if (!client.full_name) patch.full_name = "Damion Victrum";
    if (!client.referred_at) patch.referred_at = client.created_at || new Date().toISOString();
    if (Object.keys(patch).length) {
      await admin.from("clients").update(patch).eq("id", clientId);
      console.log("repaired Damion client fields", patch);
    }
  }

  if (!force) {
    const hasContact = await hasNonHospitalityContactLog(clientId);
    if (!hasContact) return { ready: false, reason: "no_contact" };
  } else {
    const hasContact = await hasNonHospitalityContactLog(clientId);
    if (!hasContact) {
      console.log("force id has no casework contact?", clientId);
      return { ready: false, reason: "no_contact" };
    }
  }

  let { data: billing } = await admin
    .from("intake_billings")
    .select("id, status")
    .eq("client_id", clientId)
    .maybeSingle();

  if (billing?.status === "billed" || billing?.status === "paid") {
    return { ready: false, reason: "already_billed" };
  }
  if (billing?.status === "ready_to_bill") {
    return { ready: false, reason: "already_ready" };
  }

  const now = new Date().toISOString();
  if (!billing) {
    const { data: created, error } = await admin
      .from("intake_billings")
      .insert({
        client_id: clientId,
        status: "scheduled",
        scheduled_at: null,
      })
      .select("id, status")
      .single();
    if (error || !created) {
      console.error("create billing failed", clientId, error?.message);
      return { ready: false, reason: "create_failed" };
    }
    billing = created;
  }

  const { error: updErr } = await admin
    .from("intake_billings")
    .update({
      status: "ready_to_bill",
      ready_at: now,
      ready_reason: "contact_log",
      updated_at: now,
    })
    .eq("id", billing.id)
    .eq("status", "scheduled");
  if (updErr) {
    console.error("ready update failed", clientId, updErr.message);
    return { ready: false, reason: "update_failed" };
  }

  await notifyAccountsReady(clientId);
  const label = await clientLabel(clientId);
  console.log("READY", label, clientId);
  return { ready: true };
}

const seen = new Set();
let marked = 0;

for (const id of FORCE_IDS) {
  seen.add(id);
  const result = await markReady(id, { force: true });
  if (result.ready) marked += 1;
  else console.log("force result", id, result);
}

const { data: referred } = await admin
  .from("clients")
  .select("id")
  .not("referred_at", "is", null)
  .is("archived_at", null)
  .order("referred_at", { ascending: false })
  .limit(500);

for (const row of referred ?? []) {
  if (seen.has(row.id)) continue;
  const result = await markReady(row.id);
  if (result.ready) marked += 1;
}

console.log("\nDone. Newly marked ready:", marked);
