import assert from "node:assert/strict";
import test from "node:test";
import { authorizationMatchesProgramGroupHeader } from "./pre-ets-program-group-roster";
import { pickRepresentativePreEtsAuthorization } from "./pre-ets-school-pipeline";

test("pickRepresentativePreEtsAuthorization prefers group then pending", () => {
  const auths = [
    { id: "a", auth_type: "individual" },
    { id: "b", auth_type: "pending" },
    { id: "c", auth_type: "group" },
  ];
  assert.equal(pickRepresentativePreEtsAuthorization(auths)?.id, "c");

  const pendingFirst = [
    { id: "p", auth_type: "pending" },
    { id: "i", auth_type: "individual" },
  ];
  assert.equal(pickRepresentativePreEtsAuthorization(pendingFirst)?.id, "p");

  const individuals = [
    { id: "i1", auth_type: "individual" },
    { id: "i2", auth_type: "individual" },
  ];
  assert.equal(pickRepresentativePreEtsAuthorization(individuals)?.id, "i1");
});

test("pipeline auth pick ignores authorizations from another group header line", () => {
  const programGroup = {
    worksheet_header_key: "dougherty county high school - group 2",
    header_raw: "DOUGHERTY COUNTY HIGH SCHOOL - GROUP 2 -",
  };
  const auths = [
    {
      id: "g1",
      auth_type: "group",
      auth_number: "12345",
      worksheet_header_key: "dougherty county high school - group 1",
    },
    {
      id: "g2",
      auth_type: "group",
      auth_number: "67890",
      worksheet_header_key: "dougherty county high school - group 2",
    },
  ];
  const scoped = auths.filter((a) =>
    authorizationMatchesProgramGroupHeader(programGroup, a.worksheet_header_key)
  );
  assert.equal(pickRepresentativePreEtsAuthorization(scoped)?.id, "g2");
});
