// Imports the roster CSV into Wayfinder Pro using the service-role key.
// Idempotent: re-running skips clients that already exist (login-less, matched by full_name).
// Requires migration 20260707181500_client_roster_without_login.sql to be applied first.
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  canonicalCounselorName,
  loadEnvFile,
  norm,
  parseCsvFile,
  repoRoot,
  tmpDir,
} from "./lib/roster-shared.mjs";

const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnvFile(join(repoRoot(), ".env.local"));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAll(table, columns, mod) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(columns).range(from, from + 999);
    if (mod) q = mod(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

// Preflight: confirm migration applied.
{
  const { error } = await supabase.from("clients").select("full_name").limit(1);
  if (error && /full_name/.test(error.message)) {
    console.error("ERROR: clients.full_name missing. Apply migration 20260707181500 first.");
    process.exit(1);
  }
}

const rows = parseCsvFile(join(tmpDir(), "wayfinder-roster-import.csv"));
console.log(`Rows in CSV: ${rows.length}${DRY_RUN ? "  (DRY RUN)" : ""}`);

// Lookups
const counselors = await fetchAll("counselors", "id, full_name");
const counselorByName = new Map(counselors.map((c) => [norm(c.full_name), c.id]));

const profiles = await fetchAll("profiles", "id, full_name, role", (q) =>
  q.in("role", ["es", "supervisor"])
);
const emailById = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error(`auth: ${error.message}`);
  for (const u of data.users) emailById.set(u.id, (u.email ?? "").trim().toLowerCase());
  if (data.users.length < 1000) break;
}
const esIdByEmail = new Map();
for (const p of profiles) {
  const email = emailById.get(p.id);
  if (email) esIdByEmail.set(email, p.id);
}

// Existing login-less roster clients (idempotency)
const existing = await fetchAll("clients", "id, full_name, user_id", (q) => q.is("user_id", null));
const existingByName = new Map();
for (const c of existing) {
  if (c.full_name) existingByName.set(norm(c.full_name), c.id);
}

let created = 0;
let skipped = 0;
let esAssigned = 0;
let counselorAttached = 0;
const failures = [];

for (const row of rows) {
  const name = row.client_name.trim();
  if (!name) continue;

  const counselorId = row.counselor ? counselorByName.get(norm(canonicalCounselorName(row.counselor))) ?? null : null;
  if (row.counselor && !counselorId) {
    failures.push(`${name}: counselor "${row.counselor}" not found`);
  }
  const esId = row.es_email ? esIdByEmail.get(row.es_email.trim().toLowerCase()) ?? null : null;
  if (row.es_email && !esId) {
    failures.push(`${name}: ES email "${row.es_email}" not found`);
  }

  let clientId = existingByName.get(norm(name));

  if (clientId) {
    skipped++;
  } else if (DRY_RUN) {
    created++;
    if (counselorId) counselorAttached++;
  } else {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        full_name: name,
        counselor_id: counselorId,
        employment_goal_primary: row.employment_goal || null,
        user_id: null,
        profile_id: null,
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      failures.push(`${name}: insert failed — ${error?.message}`);
      continue;
    }
    clientId = data.id;
    existingByName.set(norm(name), clientId);
    created++;
    if (counselorId) counselorAttached++;
  }

  // ES assignment (idempotent via unique constraint)
  if (esId && clientId && !DRY_RUN) {
    const { error } = await supabase
      .from("es_client_assignments")
      .upsert({ es_user_id: esId, client_id: clientId }, { onConflict: "es_user_id,client_id" });
    if (error) {
      failures.push(`${name}: ES assign failed — ${error.message}`);
    } else {
      esAssigned++;
    }
  } else if (esId && DRY_RUN) {
    esAssigned++;
  }
}

console.log("\n=== IMPORT SUMMARY ===");
console.log(`Created:            ${created}`);
console.log(`Already existed:    ${skipped}`);
console.log(`ES assignments:     ${esAssigned}`);
console.log(`Counselor attached: ${counselorAttached}`);
console.log(`Failures:           ${failures.length}`);
for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
if (failures.length > 40) console.log(`  ...and ${failures.length - 40} more`);
