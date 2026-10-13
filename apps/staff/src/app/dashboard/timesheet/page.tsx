import { redirect } from "next/navigation";
import { BILLABLE_HOURS_TIMESHEET_PATH } from "@/lib/load-timesheet-section";

type PageProps = {
  searchParams: Promise<{ week?: string; es?: string; client?: string }>;
};

/** Legacy route — weekly timesheet lives on Billable Hours. */
export default async function TimesheetRedirectPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.week) qs.set("week", params.week);
  if (params.es) qs.set("es", params.es);
  if (params.client) qs.set("client", params.client);
  const query = qs.toString();
  redirect(`${BILLABLE_HOURS_TIMESHEET_PATH}${query ? `?${query}` : ""}#weekly-timesheet`);
}
