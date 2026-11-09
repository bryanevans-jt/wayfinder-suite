/** Normalize a PEM private key from Vercel/env storage into OpenSSL-usable form. */
export function normalizeGooglePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  // Vercel often stores literal `\n` (sometimes double-escaped).
  key = key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
  if (!key.includes("BEGIN") && key.includes("MII")) {
    key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  }
  return key;
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export function googleServiceAccountCredentials() {
  return {
    clientEmail: requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: normalizeGooglePrivateKey(requireEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")),
  };
}
