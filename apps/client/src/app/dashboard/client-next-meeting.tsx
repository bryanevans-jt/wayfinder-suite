import { formatPortalDateTime } from "@wayfinder/branding";
import { createServerClient, resolveDashboardClient } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { MeetingActions } from "./meeting-actions";

type Props = {
  selectedClientId?: string;
};

export async function ClientNextMeeting({ selectedClientId }: Props) {
  const session = await getAppSession();
  if (!session) {
    return null;
  }

  const supabase = await createServerClient();
  const ctx = await resolveDashboardClient(
    supabase,
    session.effectiveUserId,
    session.effectiveRole,
    selectedClientId
  );

  if (!ctx) {
    return null;
  }

  const now = new Date().toISOString();

  const { data: meetings } = await supabase
    .from("client_meeting_requests")
    .select("id, status, starts_at, timezone, location, service_id, es_user_id")
    .eq("client_id", ctx.clientId)
    .in("status", ["pending", "accepted"])
    .order("starts_at", { ascending: true });

  const acceptedFuture = (meetings ?? []).find(
    (m) => m.status === "accepted" && (m.starts_at as string) >= now
  );
  const pending = (meetings ?? []).find((m) => m.status === "pending");
  const meeting = acceptedFuture ?? pending;

  let serviceName: string | null = null;
  let esName: string | null = null;

  if (meeting) {
    if (meeting.service_id) {
      const { data: svc } = await supabase
        .from("services")
        .select("name")
        .eq("id", meeting.service_id as string)
        .maybeSingle();
      serviceName = svc?.name ?? null;
    }
    if (meeting.es_user_id) {
      const { data: esProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", meeting.es_user_id as string)
        .maybeSingle();
      esName = esProfile?.full_name ?? null;
    }
  }

  const isPending = meeting?.status === "pending";

  return (
    <section className="rounded-2xl border-2 border-brand-green/30 bg-gradient-to-br from-brand-white to-brand-green/5 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-green">Next meeting</h2>
      {!meeting ? (
        <p className="mt-2 text-sm text-brand-black/70">
          No upcoming meetings. Your employment specialist will send an invite when it&apos;s time
          to meet.
        </p>
      ) : (
        <>
          <p className="mt-3 text-xl font-semibold text-brand-black">
            {serviceName ?? "Wayfinder service"} meeting
            {esName ? ` with ${esName}` : ""}
          </p>
          <dl className="mt-4 grid gap-2 text-sm">
            <div>
              <dt className="font-medium text-brand-black/55">When</dt>
              <dd className="text-brand-black">
                {formatPortalDateTime(meeting.starts_at as string)}
                {meeting.timezone ? ` (${meeting.timezone as string})` : ""}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-brand-black/55">Where</dt>
              <dd className="text-brand-black">{meeting.location as string}</dd>
            </div>
            {isPending ? (
              <div>
                <dt className="font-medium text-brand-black/55">Status</dt>
                <dd className="font-semibold text-brand-gold">Awaiting your response</dd>
              </div>
            ) : null}
          </dl>
          {!ctx.readOnly ? (
            <MeetingActions
              meetingId={meeting.id as string}
              status={meeting.status as string}
              startsAt={meeting.starts_at as string}
              location={meeting.location as string}
              title={`${serviceName ?? "Wayfinder"} meeting${esName ? ` with ${esName}` : ""}`}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
