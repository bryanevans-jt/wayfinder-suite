import {
  employmentCategoryLabel,
  employmentGoalsMatch,
  normalizeEmploymentGoal,
  type EmploymentGoalInput,
} from "@wayfinder/branding";
import { distanceMiles, EMPLOYER_MATCH_RADIUS_MILES } from "@/lib/geocoding";

export type ClientMatchProfile = {
  home_latitude: number | null;
  home_longitude: number | null;
  employment_goal_primary: string | null;
  employment_goal_primary_other: string | null;
  employment_goal_secondary: string | null;
  employment_goal_secondary_other: string | null;
};

export type EmployerMatchCandidate = {
  id: string;
  name: string;
  status: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  position_need_primary: string | null;
  position_need_primary_other: string | null;
  position_need_secondary: string | null;
  position_need_secondary_other: string | null;
};

export type EmployerMatchResult = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  distanceMiles: number;
  matchedGoals: string[];
};

function clientGoals(client: ClientMatchProfile): EmploymentGoalInput[] {
  return [
    normalizeEmploymentGoal(client.employment_goal_primary, client.employment_goal_primary_other),
    normalizeEmploymentGoal(
      client.employment_goal_secondary,
      client.employment_goal_secondary_other
    ),
  ].filter(Boolean) as EmploymentGoalInput[];
}

function employerNeeds(employer: EmployerMatchCandidate): EmploymentGoalInput[] {
  return [
    normalizeEmploymentGoal(employer.position_need_primary, employer.position_need_primary_other),
    normalizeEmploymentGoal(
      employer.position_need_secondary,
      employer.position_need_secondary_other
    ),
  ].filter(Boolean) as EmploymentGoalInput[];
}

function matchedGoalLabels(
  goals: EmploymentGoalInput[],
  needs: EmploymentGoalInput[]
): string[] {
  const labels: string[] = [];
  for (const goal of goals) {
    for (const need of needs) {
      if (employmentGoalsMatch(goal, need)) {
        const label = employmentCategoryLabel(goal.category, goal.otherText);
        if (!labels.includes(label)) {
          labels.push(label);
        }
      }
    }
  }
  return labels;
}

export function findEmployerMatches(
  client: ClientMatchProfile,
  employers: EmployerMatchCandidate[]
): EmployerMatchResult[] {
  const goals = clientGoals(client);
  if (goals.length === 0) {
    return [];
  }

  if (client.home_latitude == null || client.home_longitude == null) {
    return [];
  }

  const clientPoint = {
    latitude: client.home_latitude,
    longitude: client.home_longitude,
  };

  const results: EmployerMatchResult[] = [];

  for (const employer of employers) {
    if (employer.status !== "active") {
      continue;
    }
    if (employer.latitude == null || employer.longitude == null) {
      continue;
    }

    const needs = employerNeeds(employer);
    if (needs.length === 0) {
      continue;
    }

    const matchedGoals = matchedGoalLabels(goals, needs);
    if (matchedGoals.length === 0) {
      continue;
    }

    const miles = distanceMiles(clientPoint, {
      latitude: employer.latitude,
      longitude: employer.longitude,
    });

    if (miles > EMPLOYER_MATCH_RADIUS_MILES) {
      continue;
    }

    results.push({
      id: employer.id,
      name: employer.name,
      city: employer.city,
      state: employer.state,
      distanceMiles: Math.round(miles * 10) / 10,
      matchedGoals,
    });
  }

  return results.sort((a, b) => a.distanceMiles - b.distanceMiles || a.name.localeCompare(b.name));
}

export type ClientMatchCandidate = ClientMatchProfile & {
  id: string;
  label: string;
};

export type ClientMatchResult = {
  id: string;
  label: string;
  distanceMiles: number;
  matchedGoals: string[];
};

export function findClientMatchesForEmployer(
  employer: EmployerMatchCandidate,
  clients: ClientMatchCandidate[],
  options?: { treatAsActive?: boolean }
): ClientMatchResult[] {
  if (!options?.treatAsActive && employer.status !== "active") {
    return [];
  }
  if (employer.latitude == null || employer.longitude == null) {
    return [];
  }

  const needs = employerNeeds(employer);
  if (needs.length === 0) {
    return [];
  }

  const employerPoint = {
    latitude: employer.latitude,
    longitude: employer.longitude,
  };

  const results: ClientMatchResult[] = [];

  for (const client of clients) {
    const goals = clientGoals(client);
    if (goals.length === 0) {
      continue;
    }
    if (client.home_latitude == null || client.home_longitude == null) {
      continue;
    }

    const matchedGoals = matchedGoalLabels(goals, needs);
    if (matchedGoals.length === 0) {
      continue;
    }

    const miles = distanceMiles(
      { latitude: client.home_latitude, longitude: client.home_longitude },
      employerPoint
    );

    if (miles > EMPLOYER_MATCH_RADIUS_MILES) {
      continue;
    }

    results.push({
      id: client.id,
      label: client.label,
      distanceMiles: Math.round(miles * 10) / 10,
      matchedGoals,
    });
  }

  return results.sort((a, b) => a.distanceMiles - b.distanceMiles || a.label.localeCompare(b.label));
}

export type EmployerMatchEligibility =
  | { ready: true }
  | { ready: false; reason: "inactive" | "missing_positions" | "missing_geocode" };

export function employerMatchEligibility(
  employer: EmployerMatchCandidate
): EmployerMatchEligibility {
  if (employer.status !== "active") {
    return { ready: false, reason: "inactive" };
  }
  if (employerNeeds(employer).length === 0) {
    return { ready: false, reason: "missing_positions" };
  }
  if (employer.latitude == null || employer.longitude == null) {
    return { ready: false, reason: "missing_geocode" };
  }
  return { ready: true };
}

export type MatchEligibility =
  | { ready: true }
  | { ready: false; reason: "missing_goals" | "missing_address" | "missing_geocode" };

export function matchEligibility(client: ClientMatchProfile): MatchEligibility {
  if (clientGoals(client).length === 0) {
    return { ready: false, reason: "missing_goals" };
  }
  const hasAddressParts =
    Boolean(client.home_latitude != null && client.home_longitude != null) ||
    false;
  if (!hasAddressParts) {
    // distinguish address vs geocode in UI via separate check
    return { ready: false, reason: "missing_geocode" };
  }
  return { ready: true };
}
