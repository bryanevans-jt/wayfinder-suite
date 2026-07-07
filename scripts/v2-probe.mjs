// READ-ONLY probe of the legacy JT Reports v2 Supabase project.
// Loads credentials from .env.v2.local. Never writes to the v2 database.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.v2.local");

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const env = loadEnv(envPath);
const url = env.V2_SUPABASE_URL;
const key = env.V2_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing V2_SUPABASE_URL or V2_SUPABASE_SERVICE_ROLE_KEY in .env.v2.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = [
  "clients",
  "monthly_se_reports",
  "vpr_submissions",
  "report_jobs",
  "user_roles",
  "admin_config",
  "supervisor_invites",
];

console.log(`Probing v2 project: ${url}\n`);

for (const table of TABLES) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    console.log(`- ${table}: NOT ACCESSIBLE (${error.message})`);
    continue;
  }
  console.log(`- ${table}: ${count} rows`);
  const { data: sample } = await supabase.from(table).select("*").limit(1);
  if (sample && sample[0]) {
    console.log(`    columns: ${Object.keys(sample[0]).join(", ")}`);
  }
}
