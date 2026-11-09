import { createHash, randomBytes } from "node:crypto";

/** Generate a high-entropy URL token (returned once) and its stored hash. */
export function issueBookingToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashBookingToken(token) };
}

export function hashBookingToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokensMatch(rawToken: string, storedHash: string): boolean {
  if (!rawToken || !storedHash) return false;
  const hashed = hashBookingToken(rawToken);
  if (hashed.length !== storedHash.length) return false;
  // Constant-time compare
  let mismatch = 0;
  for (let i = 0; i < hashed.length; i++) {
    mismatch |= hashed.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return mismatch === 0;
}
