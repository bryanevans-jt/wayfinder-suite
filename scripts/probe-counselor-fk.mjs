// Probe what clients.counselor_id actually references. Inserts+deletes a throwaway row.
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile, repoRoot } from "./lib/roster-shared.mjs";

const env = loadEnvFile(join(repoRoot(), ".env.local"));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: counselors } = await supabase
  .from("counselors")
  .select("id, full_name, office_id, user_id")
  .limit(3);
console.log("Sample counselors:", JSON.stringify(counselors, null, 2));

async function tryInsert(label, counselorId) {
  const { data, error } = await supabase
    .from("clients")
    .insert({ full_name: `__probe_${label}__`, counselor_id: counselorId, user_id: null, profile_id: null })
    .select("id")
    .single();
  if (error) {
    console.log(`counselor_id = ${label}: FAIL — ${error.message}`);
  } else {
    console.log(`counselor_id = ${label}: OK`);
    await supabase.from("clients").delete().eq("id", data.id);
  }
}

const c = counselors?.[0];
if (c) {
  await tryInsert("counselors.id", c.id);
  if (c.user_id) await tryInsert("counselors.user_id", c.user_id);
  else console.log("(counselor has null user_id, skipping that probe)");
}
