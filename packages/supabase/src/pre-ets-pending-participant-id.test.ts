import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPreEtsPendingParticipantId,
  isPreEtsPendingParticipantId,
} from "./pre-ets-pending-participant-id";

test("pending participant id helper", () => {
  const pid = buildPreEtsPendingParticipantId({
    schoolYear: "2026-2027",
    studentName: "Jane Doe",
    rowNumber: 12,
  });
  assert.ok(isPreEtsPendingParticipantId(pid));
  assert.ok(pid.includes("JANE-DOE"));
  assert.equal(isPreEtsPendingParticipantId("12345"), false);
});
