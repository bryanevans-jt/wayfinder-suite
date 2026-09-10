/** Normalize a school name for fuzzy comparison. */
export function normalizeSchoolNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(high school|hs|middle school|ms|elementary|school)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const ABBREVIATION_EXPANSIONS: Record<string, string> = {
  tlc: "Lee County Transitional Learning Center",
  eci: "Emmanuel County Institute",
  "hlc ware": "Harrell Learning Center",
  hlc: "Harrell Learning Center",
  cphs: "Coastal Plains High School",
  grcca: "Griffin Region College and Career Academy",
};

/** Expand known internal abbreviations before matching. */
export function expandSchoolAbbreviation(name: string): string {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  for (const [abbr, full] of Object.entries(ABBREVIATION_EXPANSIONS)) {
    if (lower === abbr) return full;
    if (lower.startsWith(`${abbr} `)) {
      return trimmed.replace(new RegExp(`^${abbr}\\s*`, "i"), `${full} `);
    }
  }
  return trimmed;
}

export type SchoolNameMatch = {
  name: string;
  score: number;
  source: "setup" | "existing";
  id?: string;
};

function tokenOverlapScore(a: string, b: string): number {
  const keyA = normalizeSchoolNameKey(expandSchoolAbbreviation(a));
  const keyB = normalizeSchoolNameKey(expandSchoolAbbreviation(b));
  if (!keyA || !keyB) return 0;
  if (keyA === keyB) return 1;
  if (keyA.includes(keyB) || keyB.includes(keyA)) return 0.92;

  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter((t) => t.length > 2));
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter((t) => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap++;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

/** Rank candidate school names against a worksheet header school name. */
export function rankSchoolNameMatches(
  query: string,
  candidates: Array<{ name: string; source: "setup" | "existing"; id?: string }>,
  options?: { minScore?: number; limit?: number }
): SchoolNameMatch[] {
  const minScore = options?.minScore ?? 0.72;
  const limit = options?.limit ?? 5;
  const expandedQuery = expandSchoolAbbreviation(query);

  const scored = candidates
    .map((c) => ({
      name: c.name,
      source: c.source,
      id: c.id,
      score: tokenOverlapScore(expandedQuery, c.name),
    }))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

export function pickBestSchoolNameMatch(
  query: string,
  candidates: Array<{ name: string; source: "setup" | "existing"; id?: string }>
): { match: SchoolNameMatch | null; ambiguous: SchoolNameMatch[] } {
  const ranked = rankSchoolNameMatches(query, candidates, { minScore: 0.72, limit: 5 });
  if (ranked.length === 0) {
    return { match: null, ambiguous: [] };
  }
  const top = ranked[0];
  const second = ranked[1];
  if (top.score >= 0.95) {
    return { match: top, ambiguous: [] };
  }
  if (second && top.score - second.score < 0.08) {
    return { match: null, ambiguous: ranked.slice(0, 3) };
  }
  return { match: top, ambiguous: [] };
}
