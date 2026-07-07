// READ-ONLY: cross-check v2 distinct ES / counselor names against Wayfinder Pro,
// and list the Wayfinder service catalog. Reads Wayfinder creds from .env.local.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, ".tmp-jtsg-reports-v2");

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

const env = loadEnv(join(root, ".env.local"));
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Normalize a name; also produce a "First Last" variant for "Last, First" inputs.
function norm(name) {
  return (name ?? "").toString().trim().replace(/\s+/g, " ").toLowerCase();
}
function variants(name) {
  const clean = (name ?? "").toString().trim().replace(/\s+/g, " ");
  const set = new Set();
  if (!clean) return set;
  set.add(norm(clean));
  if (clean.includes(",")) {
    const [last, first] = clean.split(",").map((s) => s.trim());
    if (first && last) set.add(norm(`${first} ${last}`));
  }
  return set;
}

function readCsvValues(file) {
  const text = readFileSync(join(outDir, file), "utf8").split(/\r?\n/).slice(1);
  const out = [];
  for (const line of text) {
    if (!line.trim()) continue;
    // value may be quoted (contains comma)
    let value, count;
    if (line.startsWith('"')) {
      const end = line.indexOf('"', 1);
      value = line.slice(1, end).replace(/""/g, '"');
      count = line.slice(end + 2);
    } else {
      const comma = line.lastIndexOf(",");
      value = line.slice(0, comma);
      count = line.slice(comma + 1);
    }
    out.push({ value, count: Number(count) });
  }
  return out;
}

async function fetchAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

// Wayfinder ES = profiles role 'es' (+ supervisors, since they can be caseload assignees)
const profiles = await fetchAll("profiles", "id, role, full_name, first_name, last_name, is_active");
const esProfiles = profiles.filter((p) => p.role === "es" || p.role === "supervisor");

// Emails from auth
const emailById = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error(`auth: ${error.message}`);
  for (const u of data.users) emailById.set(u.id, u.email ?? "");
  if (data.users.length < 1000) break;
}

function profName(p) {
  if (p.full_name) return p.full_name;
  const fn = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return fn;
}

const esByVariant = new Map();
for (const p of esProfiles) {
  for (const v of variants(profName(p))) {
    esByVariant.set(v, p);
  }
}

const counselors = await fetchAll("counselors", "id, full_name, office_id");
const counselorByVariant = new Map();
for (const c of counselors) {
  for (const v of variants(c.full_name)) counselorByVariant.set(v, c);
}

const services = await fetchAll("services", "id, name, state");

// Match v2 ES names
const v2es = readCsvValues("distinct-es-names.csv");
const esRows = v2es.map((e) => {
  let match = null;
  for (const v of variants(e.value)) {
    if (esByVariant.has(v)) { match = esByVariant.get(v); break; }
  }
  return {
    v2_name: e.value,
    reports: e.count,
    wf_match: match ? profName(match) : "",
    wf_email: match ? (emailById.get(match.id) ?? "") : "",
    wf_role: match ? match.role : "",
    wf_active: match ? (match.is_active === false ? "inactive" : "active") : "",
    status: match ? "MATCH" : "NO MATCH",
  };
});

const v2c = readCsvValues("distinct-counselors.csv");
const cRows = v2c.map((c) => {
  let match = null;
  for (const v of variants(c.value)) {
    if (counselorByVariant.has(v)) { match = counselorByVariant.get(v); break; }
  }
  return {
    v2_name: c.value,
    reports: c.count,
    wf_match: match ? match.full_name : "",
    status: match ? "MATCH" : "NO MATCH",
  };
});

function csvCell(v) {
  const s = (v ?? "").toString();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers, rows) {
  return [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\n") + "\n";
}

writeFileSync(join(outDir, "match-es.csv"), toCsv(["v2_name", "reports", "wf_match", "wf_email", "wf_role", "wf_active", "status"], esRows));
writeFileSync(join(outDir, "match-counselors.csv"), toCsv(["v2_name", "reports", "wf_match", "status"], cRows));
writeFileSync(join(outDir, "wf-services.csv"), toCsv(["id", "name", "state"], services.map((s) => ({ id: s.id, name: s.name, state: s.state ?? "" }))));

console.log("=== WAYFINDER PRO ===");
console.log(`ES/supervisor profiles: ${esProfiles.length} (es=${esProfiles.filter(p=>p.role==='es').length}, supervisor=${esProfiles.filter(p=>p.role==='supervisor').length})`);
console.log(`Counselors: ${counselors.length}`);
console.log(`Services: ${services.length}`);

console.log("\n=== ES MATCH ===");
console.log(`Matched: ${esRows.filter((r) => r.status === "MATCH").length} / ${esRows.length}`);
for (const r of esRows.filter((r) => r.status === "NO MATCH")) console.log(`  NO MATCH: ${r.v2_name} (${r.reports})`);

console.log("\n=== COUNSELOR MATCH ===");
console.log(`Matched: ${cRows.filter((r) => r.status === "MATCH").length} / ${cRows.length}`);
for (const r of cRows.filter((r) => r.status === "NO MATCH")) console.log(`  NO MATCH: ${r.v2_name} (${r.reports})`);

console.log("\n=== SERVICES ===");
for (const s of services) console.log(`  [${s.state ?? "?"}] ${s.name}`);
console.log(`\nWrote match CSVs to ${outDir}`);
