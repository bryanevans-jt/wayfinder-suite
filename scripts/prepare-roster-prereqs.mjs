// Creates the temporary Unassigned office and deduped counselors in Wayfinder Pro.
// READ/WRITE on Wayfinder only — never touches v2.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  canonicalCounselorName,
  loadEnvFile,
  parseCsvFile,
  repoRoot,
  ROSTER_UNASSIGNED_OFFICE_NAME,
  tmpDir,
} from "./lib/roster-shared.mjs";

const env = loadEnvFile(join(repoRoot(), ".env.local"));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const counselorRows = parseCsvFile(join(tmpDir(), "distinct-counselors.csv"));
const canonical = new Map();
for (const row of counselorRows) {
  const name = canonicalCounselorName(row.value);
  if (!name) continue;
  canonical.set(name.toLowerCase(), name);
}

const counselorNames = [...canonical.values()].sort((a, b) =>
  a.localeCompare(b, undefined, { sensitivity: "base" })
);

console.log(`Deduped counselors to create: ${counselorNames.length}`);

let { data: office } = await supabase
  .from("offices")
  .select("id, name")
  .eq("name", ROSTER_UNASSIGNED_OFFICE_NAME)
  .maybeSingle();

if (!office) {
  const { data, error } = await supabase
    .from("offices")
    .insert({ name: ROSTER_UNASSIGNED_OFFICE_NAME, state: "GA" })
    .select("id, name")
    .single();
  if (error) throw new Error(error.message);
  office = data;
  console.log(`Created office: ${office.name}`);
} else {
  console.log(`Using existing office: ${office.name}`);
}

const { data: existingCounselors } = await supabase.from("counselors").select("id, full_name");
const byName = new Map(
  (existingCounselors ?? []).map((c) => [c.full_name.toLowerCase(), c])
);

let created = 0;
let skipped = 0;
for (const name of counselorNames) {
  if (byName.has(name.toLowerCase())) {
    skipped++;
    continue;
  }
  const { error } = await supabase
    .from("counselors")
    .insert({ full_name: name, office_id: office.id });
  if (error) {
    console.error(`Failed to create counselor "${name}": ${error.message}`);
  } else {
    created++;
  }
}

console.log(`Counselors created: ${created}, already existed: ${skipped}`);
writeFileSync(
  join(tmpDir(), "counselors-created.json"),
  JSON.stringify({ officeId: office.id, names: counselorNames, created, skipped }, null, 2)
);
