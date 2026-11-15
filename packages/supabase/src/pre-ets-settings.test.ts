import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessPreEtsAccounts,
  canEditPreEtsAuthorizationNumber,
  canEditPreEtsRosterAfterAuthorization,
  canManagePreEtsSettings,
  canManagePreEtsWorksheetTestingOverride,
} from "./pre-ets-settings";
import {
  canUploadPreEtsWorksheets,
  usesPreEtsPlanningWorksheetUpload,
  worksheetUploadBypassesDistrictScope,
} from "./pre-ets-upload-scope";

const enabledSettings = {
  module_enabled: true,
  enabled_roles: [
    "super_admin",
    "admin",
    "accountant",
    "supervisor",
    "transition_specialist",
    "hr",
  ],
  worksheet_testing_override_enabled: false,
};

describe("Pre-ETS Accounts Specialist post-finalization permissions", () => {
  it("allows Accounts Specialist, Admin, and Super Admin to edit roster after authorization", () => {
    for (const role of ["accountant", "admin", "super_admin", "Accountant", " Admin "]) {
      assert.equal(
        canEditPreEtsRosterAfterAuthorization(role),
        true,
        `roster after auth ${role}`
      );
      assert.equal(
        canEditPreEtsAuthorizationNumber(role),
        true,
        `auth number ${role}`
      );
    }
  });

  it("blocks other non-admin roles from post-finalization roster and auth-number edits", () => {
    for (const role of [
      "es",
      "transition_specialist",
      "supervisor",
      "hr",
      "hospitality_specialist",
      "counselor",
      "gvra_supervisor",
      "wrt_admin",
      "instructor",
      "client",
      "support",
      "",
      null,
      undefined,
    ]) {
      assert.equal(
        canEditPreEtsRosterAfterAuthorization(role),
        false,
        `roster after auth ${String(role)}`
      );
      assert.equal(
        canEditPreEtsAuthorizationNumber(role),
        false,
        `auth number ${String(role)}`
      );
    }
  });

  it("allows only Accounts Specialist and Super Admin to upload worksheets", () => {
    assert.equal(canAccessPreEtsAccounts("accountant", enabledSettings), true);
    assert.equal(canUploadPreEtsWorksheets("accountant", enabledSettings), true);
    assert.equal(canUploadPreEtsWorksheets("super_admin", enabledSettings), true);
    assert.equal(canUploadPreEtsWorksheets("supervisor", enabledSettings), false);
    assert.equal(canUploadPreEtsWorksheets("admin", enabledSettings), false);
    assert.equal(canUploadPreEtsWorksheets("es", enabledSettings), false);
    assert.equal(canUploadPreEtsWorksheets("hr", enabledSettings), false);
    assert.equal(canUploadPreEtsWorksheets("transition_specialist", enabledSettings), false);

    const overrideOn = { ...enabledSettings, worksheet_testing_override_enabled: true };
    assert.equal(canUploadPreEtsWorksheets("admin", overrideOn), false);
    assert.equal(canUploadPreEtsWorksheets("supervisor", overrideOn), false);
  });

  it("limits planning worksheet upload to Super Admin and bypasses district scope for AS/SA", () => {
    assert.equal(usesPreEtsPlanningWorksheetUpload("super_admin"), true);
    assert.equal(usesPreEtsPlanningWorksheetUpload("accountant"), false);
    assert.equal(usesPreEtsPlanningWorksheetUpload("supervisor"), false);
    assert.equal(usesPreEtsPlanningWorksheetUpload("admin"), false);

    assert.equal(worksheetUploadBypassesDistrictScope("super_admin"), true);
    assert.equal(worksheetUploadBypassesDistrictScope("accountant"), true);
    assert.equal(worksheetUploadBypassesDistrictScope("admin"), false);
    assert.equal(worksheetUploadBypassesDistrictScope("supervisor"), false);
  });

  it("does not widen settings or worksheet-testing override beyond Admin / Super Admin", () => {
    assert.equal(canManagePreEtsSettings("accountant"), false);
    assert.equal(canManagePreEtsSettings("admin"), false);
    assert.equal(canManagePreEtsSettings("super_admin"), true);

    assert.equal(canManagePreEtsWorksheetTestingOverride("accountant"), false);
    assert.equal(canManagePreEtsWorksheetTestingOverride("admin"), true);
    assert.equal(canManagePreEtsWorksheetTestingOverride("super_admin"), true);
  });

  it("keeps authorization-number and post-finalization roster gates aligned", () => {
    const roles = [
      "accountant",
      "admin",
      "super_admin",
      "es",
      "supervisor",
      "hr",
      "transition_specialist",
      null,
    ];
    for (const role of roles) {
      assert.equal(
        canEditPreEtsAuthorizationNumber(role),
        canEditPreEtsRosterAfterAuthorization(role),
        String(role)
      );
    }
  });
});
