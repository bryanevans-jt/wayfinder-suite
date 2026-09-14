import { redirect } from "next/navigation";

/** Legacy URL — clock-in/out replaced by Billable Hours. */
export default function TimeClockPage() {
  redirect("/dashboard/billable-hours");
}
