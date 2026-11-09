import { createPrivateKey } from "node:crypto";

/**
 * Normalize a PEM private key from Vercel/env storage into an OpenSSL-usable
 * PKCS#8 PEM. Handles quoted values, escaped newlines, and PKCS#1 RSA keys.
 */
export function normalizeGooglePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  // Common Vercel paste shapes: literal \n, double-escaped \\n, CRLF.
  key = key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

  // Some dashboards collapse PEM body newlines into spaces.
  if (key.includes("BEGIN") && !key.includes("\n")) {
    key = key
      .replace(/-----BEGIN ([A-Z0-9 ]+)-----/, "-----BEGIN $1-----\n")
      .replace(/-----END ([A-Z0-9 ]+)-----/, "\n-----END $1-----")
      .replace(/([A-Za-z0-9+/=]{64})\s+/g, "$1\n");
  }

  if (!key.includes("BEGIN") && /MII[A-Za-z0-9+/=]+/.test(key)) {
    const body = key.replace(/\s+/g, "");
    const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
    key = `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
  }

  try {
    const parsed = createPrivateKey(key);
    return parsed.export({ type: "pkcs8", format: "pem" }).toString();
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid private key";
    throw new Error(
      `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY could not be parsed (${message}). Re-paste the PEM from the Google JSON key file into Vercel.`
    );
  }
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

/** Non-secret health signal for whether the Google private key is parseable. */
export function googlePrivateKeyLooksValid(): boolean {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  if (!raw) return false;
  try {
    normalizeGooglePrivateKey(raw);
    return true;
  } catch {
    return false;
  }
}
