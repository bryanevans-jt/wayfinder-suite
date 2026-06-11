import { normalizeEmploymentGoal } from "@wayfinder/branding";
import {
  findEmployerMatches,
  type EmployerMatchCandidate,
  type EmployerMatchResult,
} from "@/lib/employer-matching";

export type ClientProfileMatchFields = {
  home_latitude: number | null;
  home_longitude: number | null;
  employment_goal_primary: string | null;
  employment_goal_primary_other: string | null;
  employment_goal_secondary: string | null;
  employment_goal_secondary_other: string | null;
};

export function clientEmployerMatchSummary(
  profile: ClientProfileMatchFields,
  employers: EmployerMatchCandidate[]
): {
  matches: EmployerMatchResult[];
  missingGoals: boolean;
  missingGeocode: boolean;
} {
  const missingGoals =
    !normalizeEmploymentGoal(
      profile.employment_goal_primary,
      profile.employment_goal_primary_other
    ) &&
    !normalizeEmploymentGoal(
      profile.employment_goal_secondary,
      profile.employment_goal_secondary_other
    );
  const missingGeocode =
    profile.home_latitude == null || profile.home_longitude == null;

  return {
    matches: findEmployerMatches(profile, employers),
    missingGoals,
    missingGeocode,
  };
}
