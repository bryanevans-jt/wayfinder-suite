// Builds wayfinder-roster-import.csv from v2 extraction output.
// RETIRED — initial migration complete; do not re-run.
import { exitIfV2RosterRetired } from "./lib/v2-roster-retired.mjs";

exitIfV2RosterRetired();

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  canonicalCounselorName,
  clean,
  norm,
  parseCsvFile,
  tmpDir,
  toCsv,
} from "./lib/roster-shared.mjs";

const roster = parseCsvFile(join(tmpDir(), "roster.csv"));
const esMatches = parseCsvFile(join(tmpDir(), "match-es.csv"));

const esEmailByName = new Map();
for (const row of esMatches) {
  if (row.status === "MATCH" && row.wf_email) {
    esEmailByName.set(norm(row.v2_name), row.wf_email.trim().toLowerCase());
  }
}

const importRows = roster.map((r) => {
  const counselor = canonicalCounselorName(r.counselor_name);
  const esEmail = esEmailByName.get(norm(r.es_name)) ?? "";
  return {
    client_name: clean(r.client_name),
    counselor,
    es_email: esEmail,
    employment_goal: clean(r.employment_goal),
  };
});

const withEs = importRows.filter((r) => r.es_email).length;
const withCounselor = importRows.filter((r) => r.counselor).length;
const unmatchedEsClients = importRows.filter((r) => clean(roster.find((x) => clean(x.client_name) === r.client_name)?.es_name) && !r.es_email).length;

writeFileSync(
  join(tmpDir(), "wayfinder-roster-import.csv"),
  toCsv(["client_name", "counselor", "es_email", "employment_goal"], importRows)
);

console.log(`Wrote ${importRows.length} rows → .tmp-jtsg-reports-v2/wayfinder-roster-import.csv`);
console.log(`  With counselor: ${withCounselor}`);
console.log(`  With ES email:  ${withEs}`);
console.log(`  Clients with v2 ES but no WF match: ${unmatchedEsClients}`);
