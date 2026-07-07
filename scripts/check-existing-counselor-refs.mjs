import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile, repoRoot } from "./lib/roster-shared.mjs";

const env = loadEnvFile(join(repoRoot(), ".env.local"));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: clients } = await supabase
  .from("clients")
  .select("id, full_name, counselor_id, user_id")
  .not("counselor_id", "is", null);

const { data: counselors } = await supabase.from("counselors").select("id, full_name, user_id");
const byId = new Map(counselors.map((c) => [c.id, c]));
const byUserId = new Map(counselors.filter((c) => c.user_id).map((c) => [c.user_id, c]));

console.log("Clients with a counselor_id set:", clients?.length ?? 0);
for (const c of clients ?? []) {
  const matchId = byId.get(c.counselor_id);
  const matchUser = byUserId.get(c.counselor_id);
  console.log(
    `  client ${c.full_name ?? c.id}: counselor_id ${c.counselor_id} → ` +
      (matchId ? `counselors.id (${matchId.full_name})` : matchUser ? `counselors.user_id (${matchUser.full_name})` : "NO MATCH")
  );
}
