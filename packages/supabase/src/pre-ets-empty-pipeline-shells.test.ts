import assert from "node:assert/strict";
import test from "node:test";
import {
  isEmptyPreEtsPipelineGroupShell,
  shouldOmitEmptySchoolShell,
} from "./pre-ets-empty-pipeline-shells";
import { parseGroupHeader, splitGroupHeaderParts } from "./pre-ets-worksheet-parser";

test("shouldOmitEmptySchoolShell only after district spreadsheet commit", () => {
  assert.equal(
    shouldOmitEmptySchoolShell({ districtHasCommittedWorksheet: true }),
    true
  );
  assert.equal(
    shouldOmitEmptySchoolShell({ districtHasCommittedWorksheet: false }),
    false
  );
});

test("isEmptyPreEtsPipelineGroupShell requires no A&I and no PIDs", () => {
  assert.equal(
    isEmptyPreEtsPipelineGroupShell({ authNumbers: [], activeStudentCount: 0 }),
    true
  );
  assert.equal(
    isEmptyPreEtsPipelineGroupShell({ authNumbers: [null, ""], activeStudentCount: 0 }),
    true
  );
  assert.equal(
    isEmptyPreEtsPipelineGroupShell({ authNumbers: ["25720"], activeStudentCount: 0 }),
    false
  );
  assert.equal(
    isEmptyPreEtsPipelineGroupShell({ authNumbers: [null], activeStudentCount: 5 }),
    false
  );
});

test("splitGroupHeaderParts tolerates missing spaces around dashes", () => {
  assert.deepEqual(splitGroupHeaderParts("HARDAWAY HIGH SCHOOL -SC 1- WOODS"), [
    "HARDAWAY HIGH SCHOOL",
    "SC 1",
    "WOODS",
  ]);
  assert.deepEqual(splitGroupHeaderParts("CHARLTON COUNTY HIGH SCHOOL- INCLUSION"), [
    "CHARLTON COUNTY HIGH SCHOOL",
    "INCLUSION",
  ]);
  assert.deepEqual(splitGroupHeaderParts("EVANS HIGH SCHOOL -GROUP 2 -"), [
    "EVANS HIGH SCHOOL",
    "GROUP 2",
  ]);
  assert.equal(
    parseGroupHeader("TOOMBS COUNTY HIGH SCHOOL -SELF CONTAINED 1-").schoolName,
    "TOOMBS COUNTY HIGH SCHOOL"
  );
  assert.equal(
    parseGroupHeader("SEMINOLE COUNTY HIGH SCHOOL -INLCUSION").schoolName,
    "SEMINOLE COUNTY HIGH SCHOOL"
  );
});
