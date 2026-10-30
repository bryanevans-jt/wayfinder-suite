import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeWorksheetSchoolName,
  looksLikeKnownWorksheetSchoolLabel,
} from "./pre-ets-worksheet-known-schools";

test("Upson Lee is a known school label without High", () => {
  assert.ok(looksLikeKnownWorksheetSchoolLabel("UPSON LEE"));
  assert.equal(canonicalizeWorksheetSchoolName("UPSON LEE"), "Upson Lee High School");
  assert.equal(canonicalizeWorksheetSchoolName("UPSON-LEE HIGH"), "Upson Lee High School");
});

test("Project United is a known alternate site without High School in the label", () => {
  assert.ok(looksLikeKnownWorksheetSchoolLabel("PROJECT UNITED"));
  assert.equal(canonicalizeWorksheetSchoolName("PROJECT UNITED"), "Project United");
  assert.ok(looksLikeKnownWorksheetSchoolLabel("PROJECT HOPE"));
});

test("County-only billing labels map to high school names", () => {
  assert.ok(looksLikeKnownWorksheetSchoolLabel("HEARD COUNTY"));
  assert.ok(looksLikeKnownWorksheetSchoolLabel("Pike County"));
  assert.equal(canonicalizeWorksheetSchoolName("HEARD COUNTY"), "Heard County High School");
  assert.equal(canonicalizeWorksheetSchoolName("Heard County"), "Heard County High School");
});

test("Scintilla Charter School Valdosta maps to class setup name", () => {
  assert.ok(looksLikeKnownWorksheetSchoolLabel("SCINTILLA CHARTER SCHOOL VALDOSTA"));
  assert.equal(
    canonicalizeWorksheetSchoolName("SCINTILLA CHARTER SCHOOL VALDOSTA"),
    "Scintilla Charter School"
  );
});
