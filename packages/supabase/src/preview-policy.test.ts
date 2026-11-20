import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyDemoClientsOnlyFilter,
  canUseViewAsPreview,
  canViewAsTargetRole,
  previewMayViewClient,
  viewAsBannerCopy,
  viewAsBlocksMutation,
} from "./preview-policy";
import { VIEW_AS_STAFF_ROLES } from "./roles";

describe("View as preview policy", () => {
  it("allows only Super Admin to use View as", () => {
    assert.equal(canUseViewAsPreview("super_admin"), true);
    assert.equal(canUseViewAsPreview("admin"), false);
    assert.equal(canUseViewAsPreview("supervisor"), false);
    assert.equal(canUseViewAsPreview("es"), false);
    assert.equal(canUseViewAsPreview(null), false);
  });

  it("limits staff View as targets to the approved role list", () => {
    for (const role of VIEW_AS_STAFF_ROLES) {
      assert.equal(canViewAsTargetRole(role), true, role);
    }
    assert.equal(canViewAsTargetRole("admin"), false);
    assert.equal(canViewAsTargetRole("accountant"), false);
    assert.equal(canViewAsTargetRole("client"), false);
  });

  it("blocks mutations while previewing, except stop", () => {
    assert.equal(
      viewAsBlocksMutation({
        method: "POST",
        pathname: "/api/es/contact-log",
        isPreviewReadOnly: true,
      }),
      true
    );
    assert.equal(
      viewAsBlocksMutation({
        method: "PATCH",
        pathname: "/api/clients/abc/vpr",
        isPreviewReadOnly: true,
      }),
      true
    );
    assert.equal(
      viewAsBlocksMutation({
        method: "DELETE",
        pathname: "/api/es/clients",
        isPreviewReadOnly: true,
      }),
      true
    );
    assert.equal(
      viewAsBlocksMutation({
        method: "GET",
        pathname: "/api/es/contact-log",
        isPreviewReadOnly: true,
      }),
      false
    );
    assert.equal(
      viewAsBlocksMutation({
        method: "POST",
        pathname: "/api/preview/stop",
        isPreviewReadOnly: true,
      }),
      false
    );
    assert.equal(
      viewAsBlocksMutation({
        method: "POST",
        pathname: "/api/es/contact-log",
        isPreviewReadOnly: false,
      }),
      false
    );
  });

  it("filters client rows for demo-clients-only preview", () => {
    const rows = [
      { id: "1", is_demo: true },
      { id: "2", is_demo: false },
      { id: "3", is_demo: null },
    ];
    assert.deepEqual(
      applyDemoClientsOnlyFilter(rows, true).map((r) => r.id),
      ["1"]
    );
    assert.deepEqual(
      applyDemoClientsOnlyFilter(rows, false).map((r) => r.id),
      ["2", "3"]
    );
    assert.equal(previewMayViewClient({ demoClientsOnly: true, clientIsDemo: true }), true);
    assert.equal(previewMayViewClient({ demoClientsOnly: true, clientIsDemo: false }), false);
    assert.equal(previewMayViewClient({ demoClientsOnly: false, clientIsDemo: false }), true);
  });

  it("formats the persistent View as banner copy", () => {
    assert.equal(
      viewAsBannerCopy({ targetName: "Alex Rivera", targetRole: "es" }),
      "Viewing as Alex Rivera (Employment Specialist) — read-only"
    );
    assert.equal(
      viewAsBannerCopy({
        targetName: "Jordan Lee",
        targetRole: "supervisor",
        demoClientsOnly: true,
      }),
      "Viewing as Jordan Lee (Regional Supervisor) — read-only · demo clients only"
    );
  });
});
