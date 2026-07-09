// READ-ONLY extraction of the legacy JT Reports v2 roster.
// RETIRED — initial migration complete; do not re-run.
import { exitIfV2RosterRetired } from "./lib/v2-roster-retired.mjs";

exitIfV2RosterRetired();

// Loads credentials from .env.v2.local. Never writes to the v2 database.
// Outputs analysis + roster CSVs into .tmp-jtsg-reports-v2/ (git-ignored).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, ".tmp-jtsg-reports-v2");
mkdirSync(outDir, { recursive: true });

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

const env = loadEnv(join(root, ".env.v2.local"));
const supabase = createClient(env.V2_SUPABASE_URL, env.V2_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAll(table, columns) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function norm(name) {
  return (name ?? "")
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function cleanDisplay(name) {
  return (name ?? "").toString().trim().replace(/\s+/g, " ");
}

function csvCell(v) {
  const s = (v ?? "").toString();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers, rows) {
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(","));
  return lines.join("\n") + "\n";
}

function tally(map, key) {
  const k = cleanDisplay(key);
  if (!k) return;
  map.set(k, (map.get(k) ?? 0) + 1);
}

function tallyRowsToCsv(map) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));
}

console.log("Fetching monthly_se_reports...");
const se = await fetchAll(
  "monthly_se_reports",
  "job_seeker_name, se_specialist_name, se_provider_name, counselor_name, employment_goal, model, last_submitted, last_submitted_month, updated_at, created_at"
);

console.log("Fetching vpr_submissions...");
const vpr = await fetchAll(
  "vpr_submissions",
  "client_name, service_stage, employment_specialist_name, user_email, date, submitted_at"
);

// Per-client roster keyed by normalized client name.
const clients = new Map();

function ensureClient(name) {
  const key = norm(name);
  if (!key) return null;
  if (!clients.has(key)) {
    clients.set(key, {
      client_name: cleanDisplay(name),
      es_name: "",
      counselor_name: "",
      employment_goal: "",
      model: "",
      service_stage: "",
      sources: new Set(),
      se_reports: 0,
      vpr_reports: 0,
      _es_time: 0,
      _counselor_time: 0,
      _goal_time: 0,
      _model_time: 0,
      _stage_time: 0,
      last_activity: "",
    });
  }
  return clients.get(key);
}

function ts(row, ...fields) {
  for (const f of fields) {
    if (row[f]) {
      const t = Date.parse(row[f]);
      if (!Number.isNaN(t)) return t;
    }
  }
  return 0;
}

const modelTally = new Map();
const stageTally = new Map();
const esTally = new Map();
const counselorTally = new Map();

for (const r of se) {
  const c = ensureClient(r.job_seeker_name);
  if (!c) continue;
  c.sources.add("se_monthly");
  c.se_reports += 1;
  const t = ts(r, "last_submitted", "updated_at", "created_at");
  const iso = new Date(t || Date.now()).toISOString().slice(0, 10);
  if (t >= c._es_time && cleanDisplay(r.se_specialist_name)) {
    c.es_name = cleanDisplay(r.se_specialist_name);
    c._es_time = t;
  }
  if (t >= c._counselor_time && cleanDisplay(r.counselor_name)) {
    c.counselor_name = cleanDisplay(r.counselor_name);
    c._counselor_time = t;
  }
  if (t >= c._goal_time && cleanDisplay(r.employment_goal)) {
    c.employment_goal = cleanDisplay(r.employment_goal);
    c._goal_time = t;
  }
  if (t >= c._model_time && cleanDisplay(r.model)) {
    c.model = cleanDisplay(r.model);
    c._model_time = t;
  }
  if (iso > (c.last_activity || "")) c.last_activity = iso;
  tally(modelTally, r.model);
  tally(esTally, r.se_specialist_name);
  tally(counselorTally, r.counselor_name);
}

for (const r of vpr) {
  const c = ensureClient(r.client_name);
  if (!c) continue;
  c.sources.add("vpr");
  c.vpr_reports += 1;
  const t = ts(r, "date", "submitted_at");
  const iso = new Date(t || Date.now()).toISOString().slice(0, 10);
  // VPR ES only fills in if no SE ES yet, or if this VPR is more recent than the SE ES source.
  if (t >= c._es_time && cleanDisplay(r.employment_specialist_name)) {
    c.es_name = cleanDisplay(r.employment_specialist_name);
    c._es_time = t;
  }
  if (t >= c._stage_time && cleanDisplay(r.service_stage)) {
    c.service_stage = cleanDisplay(r.service_stage);
    c._stage_time = t;
  }
  if (iso > (c.last_activity || "")) c.last_activity = iso;
  tally(stageTally, r.service_stage);
  tally(esTally, r.employment_specialist_name);
}

const roster = [...clients.values()]
  .map((c) => ({
    client_name: c.client_name,
    es_name: c.es_name,
    counselor_name: c.counselor_name,
    employment_goal: c.employment_goal,
    model: c.model,
    service_stage: c.service_stage,
    sources: [...c.sources].sort().join("+"),
    se_reports: c.se_reports,
    vpr_reports: c.vpr_reports,
    last_activity: c.last_activity,
  }))
  .sort((a, b) => a.client_name.localeCompare(b.client_name, undefined, { sensitivity: "base" }));

writeFileSync(
  join(outDir, "roster.csv"),
  toCsv(
    [
      "client_name",
      "es_name",
      "counselor_name",
      "employment_goal",
      "model",
      "service_stage",
      "sources",
      "se_reports",
      "vpr_reports",
      "last_activity",
    ],
    roster
  )
);

writeFileSync(join(outDir, "distinct-models.csv"), toCsv(["value", "count"], tallyRowsToCsv(modelTally)));
writeFileSync(join(outDir, "distinct-service-stages.csv"), toCsv(["value", "count"], tallyRowsToCsv(stageTally)));
writeFileSync(join(outDir, "distinct-es-names.csv"), toCsv(["value", "count"], tallyRowsToCsv(esTally)));
writeFileSync(join(outDir, "distinct-counselors.csv"), toCsv(["value", "count"], tallyRowsToCsv(counselorTally)));

const seClients = new Set(se.map((r) => norm(r.job_seeker_name)).filter(Boolean));
const vprClients = new Set(vpr.map((r) => norm(r.client_name)).filter(Boolean));

console.log("\n=== SUMMARY ===");
console.log(`monthly_se_reports rows: ${se.length}  (distinct clients: ${seClients.size})`);
console.log(`vpr_submissions rows:    ${vpr.length}  (distinct clients: ${vprClients.size})`);
console.log(`TOTAL distinct clients:  ${roster.length}`);
console.log(`  in both sources:       ${roster.filter((r) => r.sources === "se_monthly+vpr").length}`);
console.log(`  SE only:               ${roster.filter((r) => r.sources === "se_monthly").length}`);
console.log(`  VPR only:              ${roster.filter((r) => r.sources === "vpr").length}`);
console.log(`\nDistinct ES names:       ${esTally.size}`);
console.log(`Distinct counselors:     ${counselorTally.size}`);
console.log(`Distinct models:         ${modelTally.size}`);
console.log(`Distinct service stages: ${stageTally.size}`);
console.log(`\nWrote CSVs to ${outDir}`);
