import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatWorkGoalFromPrior,
  mergePriorEnrollmentDemographics,
  type PriorEnrollmentDemographics,
} from "./prior-enrollment-copy";

describe("prior enrollment copy", () => {
  it("merges non-empty fields from sibling enrollments", () => {
    const preferred: PriorEnrollmentDemographics = {
      id: "a",
      participant_id: "p1",
      full_name: "Elizabeth Cherry",
      contact_email: null,
      user_id: null,
      profile_id: null,
      counselor_id: null,
      date_of_birth: null,
      primary_phone: null,
      secondary_phone: null,
      gender: null,
      ethnicity: null,
      disability_history: null,
      employment_goal_primary: null,
      employment_goal_primary_other: null,
      employment_goal_secondary: null,
      employment_goal_secondary_other: null,
      meeting_preference: null,
      counselor_availability: null,
      home_address_line1: null,
      home_address_line2: null,
      home_city: null,
      home_state: null,
      home_zip: null,
    };
    const sibling: PriorEnrollmentDemographics = {
      ...preferred,
      id: "b",
      contact_email: "e@example.com",
      primary_phone: "555-0100",
      disability_history: "History from prior service",
    };
    const merged = mergePriorEnrollmentDemographics([preferred, sibling], "a");
    assert.equal(merged?.contact_email, "e@example.com");
    assert.equal(merged?.disability_history, "History from prior service");
  });

  it("formats employment goals for the referral form", () => {
    const row: PriorEnrollmentDemographics = {
      id: "a",
      participant_id: null,
      full_name: null,
      contact_email: null,
      user_id: null,
      profile_id: null,
      counselor_id: null,
      date_of_birth: null,
      primary_phone: null,
      secondary_phone: null,
      gender: null,
      ethnicity: null,
      disability_history: null,
      employment_goal_primary: "Competitive employment",
      employment_goal_primary_other: null,
      employment_goal_secondary: "Other",
      employment_goal_secondary_other: "Part-time retail",
      meeting_preference: null,
      counselor_availability: null,
      home_address_line1: null,
      home_address_line2: null,
      home_city: null,
      home_state: null,
      home_zip: null,
    };
    const text = formatWorkGoalFromPrior(row);
    assert.match(text, /Competitive employment/);
    assert.match(text, /Part-time retail/);
  });
});
