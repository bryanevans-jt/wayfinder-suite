import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeWorksheetSchoolName,
  fixWorksheetSchoolNameTypos,
  isStandaloneWorksheetSchoolSite,
  looksLikeKnownWorksheetSchoolLabel,
} from "./pre-ets-worksheet-known-schools";

test("Upson Lee is a known school label without High", () => {
  assert.ok(looksLikeKnownWorksheetSchoolLabel("UPSON LEE"));
  assert.equal(canonicalizeWorksheetSchoolName("UPSON LEE"), "Upson Lee High School");
  assert.equal(canonicalizeWorksheetSchoolName("UPSON-LEE HIGH"), "Upson Lee High School");
});

test("Showcase Transition maps to Showcase Academy from class setup", () => {
  assert.ok(looksLikeKnownWorksheetSchoolLabel("SHOWCASE TRANSITION"));
  assert.equal(canonicalizeWorksheetSchoolName("Showcase Transition"), "Showcase Academy");
  assert.equal(canonicalizeWorksheetSchoolName("Showcase Academy"), "Showcase Academy");
});

test("Project United is a known alternate site without High School in the label", () => {
  assert.ok(looksLikeKnownWorksheetSchoolLabel("PROJECT UNITED"));
  assert.equal(canonicalizeWorksheetSchoolName("PROJECT UNITED"), "Project United");
  assert.ok(looksLikeKnownWorksheetSchoolLabel("PROJECT HOPE"));
});

test("Emanuel County Institute is recognized on billing sheets", () => {
  assert.ok(looksLikeKnownWorksheetSchoolLabel("EMANUEL COUNTY INSTITUTE"));
  assert.equal(
    canonicalizeWorksheetSchoolName("Emanuel County Institute"),
    "Emmanuel County Institute"
  );
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

test("Coffee County Wiregrass is recognized and Coffe typo is corrected", () => {
  assert.equal(fixWorksheetSchoolNameTypos("Coffe County Wiregrass"), "Coffee County Wiregrass");
  assert.ok(looksLikeKnownWorksheetSchoolLabel("Coffe County Wiregrass"));
  assert.equal(
    canonicalizeWorksheetSchoolName("Coffe County Wiregrass"),
    "Coffee County Wiregrass"
  );
});

test("Transitional Learning Center and TLC map to class setup TLC", () => {
  assert.ok(isStandaloneWorksheetSchoolSite("Transitional Learning Center"));
  assert.ok(isStandaloneWorksheetSchoolSite("TLC"));
  assert.ok(!isStandaloneWorksheetSchoolSite("INCLUSION"));
  assert.equal(canonicalizeWorksheetSchoolName("Transitional Learning Center"), "TLC");
  assert.equal(canonicalizeWorksheetSchoolName("TLC"), "TLC");
});

test("Thomas County Central maps to Thomas County Central High School", () => {
  assert.ok(looksLikeKnownWorksheetSchoolLabel("Thomas County Central"));
  assert.equal(
    canonicalizeWorksheetSchoolName("Thomas County Central"),
    "Thomas County Central High School"
  );
  assert.equal(
    canonicalizeWorksheetSchoolName("THOMAS COUNTY CENTRAL HIGH"),
    "Thomas County Central High School"
  );
});

test("Harrell Learning Center and HLC billing shorthand are recognized", () => {
  assert.ok(looksLikeKnownWorksheetSchoolLabel("Harrell Learning Center"));
  assert.ok(looksLikeKnownWorksheetSchoolLabel("HLC WARE"));
  assert.equal(canonicalizeWorksheetSchoolName("HLC"), "Harrell Learning Center");
  assert.equal(
    canonicalizeWorksheetSchoolName("Harrell Learning Center"),
    "Harrell Learning Center"
  );
});
