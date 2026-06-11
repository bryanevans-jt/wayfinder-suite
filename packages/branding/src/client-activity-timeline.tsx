import { formatPortalDateTime } from "./portal-datetime";

export type ClientActivityFeedItem =
  | {
      kind: "contact";
      id: string;
      at: string;
      public_outcome: string | null;
      notes: string | null;
    }
  | { kind: "milestone"; id: string; at: string; title: string }
  | {
      kind: "application";
      id: string;
      at: string;
      status: string | null;
      status_other_reason?: string | null;
      company_name: string | null;
      notes: string | null;
    }
  | {
      kind: "meeting";
      id: string;
      at: string;
      status: string;
      starts_at: string;
      location: string;
      timezone: string;
      service_name: string | null;
      es_name: string | null;
    };

type Props = {
  feed: ClientActivityFeedItem[];
  emptyMessage?: string;
};

export function ClientActivityTimeline({
  feed,
  emptyMessage = "No activity yet for this client.",
}: Props) {
  if (feed.length === 0) {
    return <p className="mt-6 text-sm text-brand-black/60">{emptyMessage}</p>;
  }

  return (
    <ol className="relative mt-6 list-none space-y-0 border-l border-neutral-200 pl-6">
      {feed.map((item) => (
        <li key={`${item.kind}-${item.id}`} className="mb-10 last:mb-0">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-green" />
          <time
            className="text-xs font-semibold uppercase tracking-wide text-brand-black/55"
            dateTime={item.at}
          >
            {formatPortalDateTime(item.at)}
          </time>
          {item.kind === "milestone" ? (
            <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                Milestone
              </p>
              <p className="mt-1 text-base font-medium text-brand-black">{item.title}</p>
            </div>
          ) : item.kind === "application" ? (
            <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">
                Application
              </p>
              <p className="mt-2 text-base font-semibold text-brand-black">
                {item.company_name?.trim() || "Employer not specified"}
              </p>
              <p className="mt-1 text-sm text-brand-black/80">
                Status: {item.status?.trim() || "—"}
              </p>
              {item.status?.trim().toLowerCase() === "other" && item.status_other_reason?.trim() ? (
                <p className="mt-1 text-sm text-brand-black/75">
                  Reason: {item.status_other_reason}
                </p>
              ) : null}
              {item.notes?.trim() ? (
                <p className="mt-3 border-t border-neutral-100 pt-3 text-sm text-brand-black/75">
                  {item.notes}
                </p>
              ) : null}
            </div>
          ) : item.kind === "meeting" ? (
            <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                Meeting
              </p>
              <p className="mt-2 text-base font-semibold text-brand-black">
                {item.service_name?.trim() || "Wayfinder service"} meeting
                {item.es_name ? ` with ${item.es_name}` : ""}
              </p>
              <p className="mt-1 text-sm text-brand-black/80">
                {formatPortalDateTime(item.starts_at)} · {item.location}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-brand-black/55">
                {item.status}
              </p>
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                Contact log
              </p>
              <p className="mt-2 text-base font-semibold leading-snug text-brand-black">
                Outcome:{" "}
                <span className="font-bold">
                  {item.public_outcome?.trim() ? item.public_outcome : "—"}
                </span>
              </p>
              {item.notes?.trim() ? (
                <p className="mt-3 border-t border-neutral-100 pt-3 text-sm text-brand-black/75">
                  {item.notes}
                </p>
              ) : null}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
