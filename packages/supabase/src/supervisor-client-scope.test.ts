import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esUserAllowedForSupervisor, type SupervisorScope } from "./supervisor-client-scope";

describe("supervisor-client-scope", () => {
  it("allows supervisor self and explicit ES links only", () => {
    const scope: SupervisorScope = {
      supervisorUserId: "sup-1",
      officeIds: ["office-a"],
      esUserIds: ["es-1", "ts-1"],
    };
    assert.equal(esUserAllowedForSupervisor(scope, "sup-1"), true);
    assert.equal(esUserAllowedForSupervisor(scope, "es-1"), true);
    assert.equal(esUserAllowedForSupervisor(scope, "ts-1"), true);
    assert.equal(esUserAllowedForSupervisor(scope, "es-2"), false);
  });
});
