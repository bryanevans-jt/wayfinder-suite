import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  preEtsAuthorizationEventLabel,
  preEtsInvoicePacketEventLabel,
} from "./pre-ets-event-labels";

describe("preEtsInvoicePacketEventLabel", () => {
  it("maps known packet event kinds to friendly labels", () => {
    assert.equal(preEtsInvoicePacketEventLabel("draft_totals_refreshed"), "Draft totals refreshed");
    assert.equal(preEtsInvoicePacketEventLabel("created"), "Created");
    assert.equal(preEtsInvoicePacketEventLabel("status_changed"), "Status changed");
    assert.equal(preEtsInvoicePacketEventLabel("pdf_generated"), "PDF generated");
    assert.equal(preEtsInvoicePacketEventLabel("drive_archived"), "Archived to Drive");
    assert.equal(preEtsInvoicePacketEventLabel("notes_updated"), "Notes updated");
  });

  it("passes through unknown kinds", () => {
    assert.equal(preEtsInvoicePacketEventLabel("custom_kind"), "custom_kind");
  });
});

describe("preEtsAuthorizationEventLabel", () => {
  it("maps known authorization event kinds to friendly labels", () => {
    assert.equal(
      preEtsAuthorizationEventLabel("auth_number_changed"),
      "Authorization number changed"
    );
    assert.equal(
      preEtsAuthorizationEventLabel("roster_students_changed"),
      "Roster students changed"
    );
  });
});
