// READ-ONLY: inspect live clients id/profile_id/user_id data health.
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile, repoRoot } from "./lib/roster-shared.mjs";

const env = loadEnvFile(join(repoRoot(), ".env.local"));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAll(cols) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("clients").select(cols).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

const rows = await fetchAll("id, user_id, profile_id, full_name");
console.log("Total clients:", rows.length);
console.log("null id:", rows.filter((r) => !r.id).length);
console.log("null user_id:", rows.filter((r) => !r.user_id).length);
console.log("null profile_id:", rows.filter((r) => !r.profile_id).length);
console.log("id === profile_id:", rows.filter((r) => r.id === r.profile_id).length);
console.log("id === user_id:", rows.filter((r) => r.id === r.user_id).length);
const ids = new Set(rows.map((r) => r.id));
console.log("distinct ids:", ids.size, ids.size === rows.length ? "(all unique)" : "(DUPLICATES!)");
console.log("existing roster (full_name, no user_id):", rows.filter((r) => r.full_name && !r.user_id).length);
