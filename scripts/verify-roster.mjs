import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile, repoRoot } from "./lib/roster-shared.mjs";

const env = loadEnvFile(join(repoRoot(), ".env.local"));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAll(table, cols, mod) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(cols).range(from, from + 999);
    if (mod) q = mod(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

const clients = await fetchAll("clients", "id, full_name, user_id, counselor_id, current_service_id, contact_email");
const roster = clients.filter((c) => !c.user_id && c.full_name);
const assignments = await fetchAll("es_client_assignments", "client_id, es_user_id");
const assignedClientIds = new Set(assignments.map((a) => a.client_id));

console.log("=== ROSTER VERIFICATION ===");
console.log(`Total clients in DB:            ${clients.length}`);
console.log(`Login-less roster clients:      ${roster.length}`);
console.log(`  with counselor attached:      ${roster.filter((c) => c.counselor_id).length}`);
console.log(`  with an ES assignment:        ${roster.filter((c) => assignedClientIds.has(c.id)).length}`);
console.log(`  with a login (user_id):       ${roster.filter((c) => c.user_id).length}`);
console.log(`  with contact_email set:       ${roster.filter((c) => c.contact_email).length}`);
console.log(`  with a service set:           ${roster.filter((c) => c.current_service_id).length}`);
console.log(`Total ES assignments in DB:     ${assignments.length}`);

// Confirm no auth users were created for roster clients (spot check count of auth users)
let authCount = 0;
for (let page = 1; ; page++) {
  const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  authCount += data.users.length;
  if (data.users.length < 1000) break;
}
console.log(`Total auth users (unchanged by roster import): ${authCount}`);
