export const EMPLOYMENT_CATEGORIES = [
  "stocking",
  "cleaning",
  "food_service",
  "cashier",
  "warehouse",
  "customer_service",
  "technology",
  "other",
] as const;

export type EmploymentCategory = (typeof EMPLOYMENT_CATEGORIES)[number];

export const EMPLOYMENT_CATEGORY_LABELS: Record<EmploymentCategory, string> = {
  stocking: "Stocking",
  cleaning: "Cleaning",
  food_service: "Food Service",
  cashier: "Cashier",
  warehouse: "Warehouse",
  customer_service: "Customer Service",
  technology: "Technology",
  other: "Other",
};

export function isEmploymentCategory(value: string | null | undefined): value is EmploymentCategory {
  return (EMPLOYMENT_CATEGORIES as readonly string[]).includes((value ?? "").trim().toLowerCase());
}

export function employmentCategoryLabel(
  category: string | null | undefined,
  otherText: string | null | undefined
): string {
  const key = (category ?? "").trim().toLowerCase();
  if (!isEmploymentCategory(key)) {
    return "—";
  }
  if (key === "other") {
    const custom = (otherText ?? "").trim();
    return custom ? `Other — ${custom}` : "Other";
  }
  return EMPLOYMENT_CATEGORY_LABELS[key];
}

export type EmploymentGoalInput = {
  category: string | null;
  otherText: string | null;
};

export function normalizeEmploymentGoal(
  category: string | null | undefined,
  otherText: string | null | undefined
): EmploymentGoalInput | null {
  const key = (category ?? "").trim().toLowerCase();
  if (!key) {
    return null;
  }
  if (!isEmploymentCategory(key)) {
    return null;
  }
  if (key === "other" && !(otherText ?? "").trim()) {
    return null;
  }
  return {
    category: key,
    otherText: key === "other" ? (otherText ?? "").trim() : null,
  };
}

/** True when a client goal and employer position need align (exact Other text match). */
export function employmentGoalsMatch(
  clientGoal: EmploymentGoalInput,
  employerNeed: EmploymentGoalInput
): boolean {
  if (clientGoal.category !== employerNeed.category) {
    return false;
  }
  if (clientGoal.category === "other") {
    return (
      (clientGoal.otherText ?? "").trim().toLowerCase() ===
      (employerNeed.otherText ?? "").trim().toLowerCase()
    );
  }
  return true;
}

export function validateEmploymentCategoryFields(
  category: string | null | undefined,
  otherText: string | null | undefined,
  fieldLabel: string
): { category: EmploymentCategory | null; otherText: string | null; error?: string } {
  const raw = (category ?? "").trim().toLowerCase();
  if (!raw) {
    return { category: null, otherText: null };
  }
  if (!isEmploymentCategory(raw)) {
    return { category: null, otherText: null, error: `${fieldLabel}: invalid category` };
  }
  if (raw === "other" && !(otherText ?? "").trim()) {
    return {
      category: null,
      otherText: null,
      error: `${fieldLabel}: describe the role when Other is selected`,
    };
  }
  return {
    category: raw,
    otherText: raw === "other" ? (otherText ?? "").trim() : null,
  };
}
