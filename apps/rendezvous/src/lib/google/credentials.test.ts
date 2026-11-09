import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { normalizeGooglePrivateKey } from "./credentials";

function samplePem(): string {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

describe("normalizeGooglePrivateKey", () => {
  it("accepts a normal PKCS8 PEM", () => {
    const pem = samplePem();
    const out = normalizeGooglePrivateKey(pem);
    assert.match(out, /BEGIN PRIVATE KEY/);
    assert.match(out, /END PRIVATE KEY/);
  });

  it("unwraps quoted env values and literal \\n escapes", () => {
    const pem = samplePem();
    const quoted = `"${pem.replace(/\n/g, "\\n")}"`;
    const out = normalizeGooglePrivateKey(quoted);
    assert.match(out, /BEGIN PRIVATE KEY/);
  });

  it("rejects garbage keys with a clear message", () => {
    assert.throws(
      () => normalizeGooglePrivateKey("not-a-key"),
      /GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY could not be parsed/
    );
  });
});
