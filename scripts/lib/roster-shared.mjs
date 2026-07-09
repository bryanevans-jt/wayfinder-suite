// Shared helpers for v2 → Wayfinder roster migration scripts (retired).
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const ROSTER_UNASSIGNED_OFFICE_NAME = "Unassigned (import)";

export const COUNSELOR_ALIASES = {
  "betty mathis": "Betty Kelloms-Mathis",
  "betty kelloms-mathis": "Betty Kelloms-Mathis",
  "carter, alonzo": "Alonzo Carter",
  "alonzo carter": "Alonzo Carter",
  "blank, kristie": "Kirstie Blank",
  "blank, kirstie": "Kirstie Blank",
  "kirstie blank": "Kirstie Blank",
  "keonte sligh": "Keontae Sligh",
  "keontae sligh": "Keontae Sligh",
  "juanna fletcher": "Juana Fletcher",
  "juana fletcher": "Juana Fletcher",
  "felecia anderson": "Felicia Anderson",
  "felicia anderson": "Felicia Anderson",
  "coney-horne, jabot": "Jabot Horne",
  "jabot horne": "Jabot Horne",
  "trawick, catina": "Catina Trawick",
  "wood, ann": "Ann Wood",
  "hitchcock, jasmine": "Jasmine Hitchcock",
};

export function loadEnvFile(path) {
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

export function norm(s) {
  return (s ?? "").toString().trim().replace(/\s+/g, " ").toLowerCase();
}

export function clean(s) {
  return (s ?? "").toString().trim().replace(/\s+/g, " ");
}

export function canonicalCounselorName(name) {
  const n = clean(name);
  if (!n) return "";
  const alias = COUNSELOR_ALIASES[norm(n)];
  if (alias) return alias;
  if (n.includes(",")) {
    const [last, first] = n.split(",").map((p) => p.trim());
    if (first && last) return `${first} ${last}`;
  }
  return n;
}

export function parseCsvFile(path) {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else inQuotes = false;
      } else current += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      cells.push(current);
      current = "";
    } else current += ch;
  }
  cells.push(current);
  return cells;
}

export function csvCell(v) {
  const s = (v ?? "").toString();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers, rows) {
  return (
    [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join(
      "\n"
    ) + "\n"
  );
}

export function repoRoot() {
  return join(import.meta.dirname, "..", "..");
}

export function tmpDir() {
  return join(repoRoot(), ".tmp-jtsg-reports-v2");
}
