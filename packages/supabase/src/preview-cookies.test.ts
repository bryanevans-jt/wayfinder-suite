import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PREVIEW_ACTOR_COOKIE,
  PREVIEW_DEMO_ONLY_COOKIE,
  PREVIEW_NAME_COOKIE,
  PREVIEW_ROLE_COOKIE,
  PREVIEW_TARGET_COOKIE,
  readPreviewCookies,
} from "./preview-cookies";

describe("preview cookies", () => {
  it("reads View as cookies including demo-clients-only", () => {
    const jar = new Map<string, string>([
      [PREVIEW_TARGET_COOKIE, "target-1"],
      [PREVIEW_ACTOR_COOKIE, "actor-1"],
      [PREVIEW_ROLE_COOKIE, "es"],
      [PREVIEW_NAME_COOKIE, "Alex"],
      [PREVIEW_DEMO_ONLY_COOKIE, "1"],
    ]);
    const parsed = readPreviewCookies((name) => jar.get(name));
    assert.ok(parsed);
    assert.equal(parsed?.targetUserId, "target-1");
    assert.equal(parsed?.actorUserId, "actor-1");
    assert.equal(parsed?.targetRole, "es");
    assert.equal(parsed?.targetName, "Alex");
    assert.equal(parsed?.demoClientsOnly, true);
  });

  it("defaults demoClientsOnly to false when cookie absent", () => {
    const jar = new Map<string, string>([
      [PREVIEW_TARGET_COOKIE, "target-1"],
      [PREVIEW_ACTOR_COOKIE, "actor-1"],
      [PREVIEW_ROLE_COOKIE, "supervisor"],
    ]);
    const parsed = readPreviewCookies((name) => jar.get(name));
    assert.equal(parsed?.demoClientsOnly, false);
  });

  it("rejects unknown roles", () => {
    const jar = new Map<string, string>([
      [PREVIEW_TARGET_COOKIE, "target-1"],
      [PREVIEW_ACTOR_COOKIE, "actor-1"],
      [PREVIEW_ROLE_COOKIE, "not_a_role"],
    ]);
    assert.equal(readPreviewCookies((name) => jar.get(name)), null);
  });
});
