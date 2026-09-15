import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fieldSpecialistRoleLabel } from "./referral-field-specialists";

describe("fieldSpecialistRoleLabel", () => {
  it("labels transition specialists as TS", () => {
    assert.equal(fieldSpecialistRoleLabel("transition_specialist"), "TS");
  });

  it("labels ES and supervisors as ES", () => {
    assert.equal(fieldSpecialistRoleLabel("es"), "ES");
    assert.equal(fieldSpecialistRoleLabel("supervisor"), "ES");
  });
});
