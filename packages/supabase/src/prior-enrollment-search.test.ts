import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientRecordMatchesTextSearch,
  isClosedPriorEnrollmentForNewService,
} from "./prior-enrollment-search";

describe("prior enrollment search helpers", () => {
  it("matches multi-word names when all tokens appear", () => {
    assert.equal(
      clientRecordMatchesTextSearch("Veronica M. Morey", null, "Veronica Morey"),
      true
    );
    assert.equal(
      clientRecordMatchesTextSearch("Elizabeth Cherry", null, "Cherry"),
      true
    );
    assert.equal(
      clientRecordMatchesTextSearch("Elizabeth Cherry", "e.cherry@example.com", "cherry@example"),
      true
    );
    assert.equal(clientRecordMatchesTextSearch("Jane Doe", null, "John Doe"), false);
  });

  it("treats archived or terminal stage as closed prior enrollments", () => {
    assert.equal(
      isClosedPriorEnrollmentForNewService({
        intakeStatus: "active",
        archivedAt: "2024-01-01T00:00:00.000Z",
        stageTitle: "Job Development",
      }),
      true
    );
    assert.equal(
      isClosedPriorEnrollmentForNewService({
        intakeStatus: "active",
        archivedAt: null,
        stageTitle: "Complete",
      }),
      true
    );
    assert.equal(
      isClosedPriorEnrollmentForNewService({
        intakeStatus: "discarded",
        archivedAt: "2024-01-01T00:00:00.000Z",
        stageTitle: "Complete",
      }),
      false
    );
    assert.equal(
      isClosedPriorEnrollmentForNewService({
        intakeStatus: "active",
        archivedAt: null,
        stageTitle: "Job Development",
      }),
      false
    );
  });
});
