export type ContactLogSuggestion = {
  id: string;
  message: string;
  actionLabel?: string;
  actionType?: "add_application" | "update_application" | "schedule_follow_up";
};

export function suggestContactLogFollowUps(input: {
  activityName: string;
  narrative: string;
  daysSinceLastContact: number | null;
  hasOpenApplications: boolean;
}): ContactLogSuggestion[] {
  const suggestions: ContactLogSuggestion[] = [];
  const activity = input.activityName.toLowerCase();
  const narrative = input.narrative.toLowerCase();

  if (activity.includes("job development") || activity.includes("employer")) {
    suggestions.push({
      id: "add-application",
      message: "Consider logging a job application if you discussed a specific opening.",
      actionLabel: "Add application",
      actionType: "add_application",
    });
  }

  if (narrative.includes("interview") || activity.includes("interview")) {
    suggestions.push({
      id: "update-application",
      message: "You may want to update the application status to Interview Scheduled or Complete.",
      actionLabel: "Update application",
      actionType: "update_application",
    });
  }

  if (
    input.daysSinceLastContact != null &&
    input.daysSinceLastContact >= 10 &&
    !activity.includes("employer follow")
  ) {
    suggestions.push({
      id: "follow-up",
      message: "It has been a while since the last contact — a brief follow-up may help maintain momentum.",
      actionLabel: "Plan follow-up",
      actionType: "schedule_follow_up",
    });
  }

  if (!input.hasOpenApplications && activity.includes("placement")) {
    suggestions.push({
      id: "track-application",
      message: "Recording an application helps your team track placement progress.",
      actionLabel: "Add application",
      actionType: "add_application",
    });
  }

  return suggestions;
}
