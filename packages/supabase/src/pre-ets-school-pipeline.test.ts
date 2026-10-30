import assert from "node:assert/strict";
import test from "node:test";
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
