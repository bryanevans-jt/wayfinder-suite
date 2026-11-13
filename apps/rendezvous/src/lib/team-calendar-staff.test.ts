import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTeamCalendarStaffDirectory,
  resolveTeamCalendarPeoplePickerIds,
} from "./team-calendar-staff";
import { resolveTeamCalendarVisibilityMode } from "./team-calendar-visibility";

describe("buildTeamCalendarStaffDirectory", () => {
  it("lists schedule staff for admins even when only the viewer has bookings", () => {
    // Mirrors production: one confirmed booking (super_admin), many ES/TS schedules.
    const staff = buildTeamCalendarStaffDirectory({
      visibleStaffUserIds: ["bryan", "es-1", "ts-1", "sup-1"],
      schedules: [
        { staff_user_id: "bryan", display_name: "Bryan Evans" },
        { staff_user_id: "es-1", display_name: "Kayla Miley" },
        { staff_user_id: "ts-1", display_name: "Aaliyah Danielly" },
        { staff_user_id: "sup-1", display_name: "Ashley Kelley" },
      ],
      bookingStaffNames: { bryan: "Bryan Evans" },
    });
    assert.deepEqual(
      staff.map((s) => s.id).sort(),
      ["bryan", "es-1", "sup-1", "ts-1"].sort()
    );
    assert.equal(staff.find((s) => s.id === "es-1")?.name, "Kayla Miley");
  });

  it("never includes staff outside the visibility allow-list", () => {
    const staff = buildTeamCalendarStaffDirectory({
      visibleStaffUserIds: ["es-1"],
      schedules: [
        { staff_user_id: "es-1", display_name: "Kayla" },
        { staff_user_id: "other", display_name: "Other" },
      ],
      bookingStaffNames: { other: "Other" },
    });
    assert.deepEqual(staff, [{ id: "es-1", name: "Kayla" }]);
  });

  it("falls back to profile names when schedule display_name is blank", () => {
    const staff = buildTeamCalendarStaffDirectory({
      visibleStaffUserIds: ["es-1"],
      schedules: [{ staff_user_id: "es-1", display_name: "  " }],
      profileNames: { "es-1": "Kayla Miley" },
    });
    assert.deepEqual(staff, [{ id: "es-1", name: "Kayla Miley" }]);
  });
});

describe("resolveTeamCalendarPeoplePickerIds", () => {
  it("prefers the staff directory over booking-only ids", () => {
    assert.deepEqual(
      resolveTeamCalendarPeoplePickerIds({
        staff: [
          { id: "es-1", name: "Kayla" },
          { id: "ts-1", name: "Aaliyah" },
        ],
        bookingStaffUserIds: ["bryan"],
      }),
      ["es-1", "ts-1"]
    );
  });

  it("falls back to booking ids when staff directory is empty", () => {
    assert.deepEqual(
      resolveTeamCalendarPeoplePickerIds({
        staff: [],
        bookingStaffUserIds: ["bryan", "bryan"],
      }),
      ["bryan"]
    );
  });
});

describe("super_admin calendar visibility recognition", () => {
  it("treats super_admin as admin_team (same as admin)", () => {
    assert.equal(resolveTeamCalendarVisibilityMode("super_admin"), "admin_team");
    assert.equal(resolveTeamCalendarVisibilityMode("admin"), "admin_team");
  });
});
