import assert from "node:assert/strict";
import test from "node:test";
import { authorizationMatchesProgramGroupHeader } from "./pre-ets-program-group-roster";

test("roster auths must match the program group spreadsheet header key", () => {
  const fairGroup = {
    worksheet_header_key:
      "appling county high school - day at the fair",
    header_raw: "APPLING COUNTY HIGH - DAY AT THE FAIR",
  };
  const mainKey = "appling county high school - main";

  assert.ok(
    authorizationMatchesProgramGroupHeader(fairGroup, "APPLING COUNTY HIGH - DAY AT THE FAIR")
  );
  assert.equal(authorizationMatchesProgramGroupHeader(fairGroup, mainKey), false);
});

test("Valdosta inclusion headers stay distinct", () => {
  const group1 = {
    worksheet_header_key: "valdosta high school - inclusion - group 1",
    header_raw: "VALDOSTA HIGH SCHOOL - INCLUSION - GROUP 1",
  };
  const thomas = {
    worksheet_header_key: "valdosta high school - inclusion - thomas",
    header_raw: "VALDOSTA HIGH SCHOOL - INCLUSION - THOMAS",
  };

  assert.ok(
    authorizationMatchesProgramGroupHeader(group1, "VALDOSTA HIGH SCHOOL - INCLUSION - GROUP 1")
  );
  assert.equal(
    authorizationMatchesProgramGroupHeader(group1, "VALDOSTA HIGH SCHOOL - INCLUSION - THOMAS"),
    false
  );
  assert.ok(
    authorizationMatchesProgramGroupHeader(thomas, "VALDOSTA HIGH SCHOOL - INCLUSION - THOMAS")
  );
  assert.equal(
    authorizationMatchesProgramGroupHeader(thomas, "VALDOSTA HIGH SCHOOL - INCLUSION - GROUP 1"),
    false
  );
});
