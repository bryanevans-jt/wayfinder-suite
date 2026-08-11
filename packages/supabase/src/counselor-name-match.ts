export type CounselorNameMatchKind = "exact" | "near";

export function normalizeCounselorName(name: string): string {
  let trimmed = name.trim();
  if (trimmed.includes(",")) {
    const [last, first] = trimmed.split(",").map((part) => part.trim());
    if (first && last) {
      trimmed = `${first} ${last}`;
    }
  }
  return trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['.`]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function counselorNameTokens(name: string): string[] {
  return normalizeCounselorName(name).split(" ").filter(Boolean);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function counselorNameMatchKind(
  left: string,
  right: string
): CounselorNameMatchKind | null {
  const a = normalizeCounselorName(left);
  const b = normalizeCounselorName(right);
  if (!a || !b) return null;
  if (a === b || a.replace(/\s+/g, "") === b.replace(/\s+/g, "")) {
    return "exact";
  }

  const ta = counselorNameTokens(left);
  const tb = counselorNameTokens(right);
  if (ta.length >= 2 && tb.length >= 2) {
    if (`${ta[0]} ${ta[ta.length - 1]}` === `${tb[0]} ${tb[tb.length - 1]}`) {
      return "near";
    }
    if (ta[ta.length - 1] === tb[tb.length - 1]) {
      const firstA = ta[0];
      const firstB = tb[0];
      const shorter = firstA.length <= firstB.length ? firstA : firstB;
      const longer = firstA.length <= firstB.length ? firstB : firstA;
      if (shorter.length === 1 && longer.startsWith(shorter)) {
        return "near";
      }
      if (
        Math.min(firstA.length, firstB.length) >= 3 &&
        levenshtein(firstA, firstB) <= 2
      ) {
        return "near";
      }
    }
  }

  const maxLen = Math.max(a.length, b.length);
  if (maxLen >= 6) {
    const distance = levenshtein(a, b);
    if (distance <= 4 && distance / maxLen <= 0.2) {
      return "near";
    }
  }

  return null;
}

export function counselorDuplicatePairKey(idA: string, idB: string): string {
  return [idA, idB].sort().join(":");
}

export type CounselorDuplicatePair<T extends { id: string; full_name: string }> = {
  left: T;
  right: T;
  kind: CounselorNameMatchKind;
};

function counselorEmails(row: {
  email?: string | null;
  contact_email?: string | null;
}): string[] {
  return [row.email, row.contact_email]
    .map((value) => (value ?? "").trim().toLowerCase())
    .filter((value) => value.includes("@"));
}

export function findCounselorDuplicatePairs<
  T extends {
    id: string;
    full_name: string;
    email?: string | null;
    contact_email?: string | null;
  },
>(rows: T[]): CounselorDuplicatePair<T>[] {
  const pairs: CounselorDuplicatePair<T>[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const kind = counselorNameMatchKind(rows[i].full_name, rows[j].full_name);
      if (kind) {
        pairs.push({ left: rows[i], right: rows[j], kind });
        continue;
      }
      const emailsA = counselorEmails(rows[i]);
      const emailsB = counselorEmails(rows[j]);
      const sameEmail = emailsA.some((email) => emailsB.includes(email));
      const sameLocal = emailsA.some((email) =>
        emailsB.some((other) => email.split("@")[0] === other.split("@")[0] && email.split("@")[0])
      );
      if (sameEmail || sameLocal) {
        pairs.push({ left: rows[i], right: rows[j], kind: "near" });
      }
    }
  }
  return pairs;
}
