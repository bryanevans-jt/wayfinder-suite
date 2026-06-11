import { employerStatusLabel } from "@/lib/employer-constants";
import { formatPortalDateTime } from "@/lib/portal-datetime";

export type EmployerStatusLogEntry = {
  id: string;
  old_status: string | null;
  new_status: string;
  created_at: string;
  changed_by_name: string | null;
};

type Props = {
  logs: EmployerStatusLogEntry[];
};

export function EmployerStatusLogPanel({ logs }: Props) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Status history
      </h2>
      <p className="mt-1 text-xs text-brand-black/60">
        Who changed this employer&apos;s status and when.
      </p>
      {logs.length === 0 ? (
        <p className="mt-4 text-sm text-brand-black/70">No status changes recorded yet.</p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          {logs.map((log) => (
            <li
              key={log.id}
              className="rounded-lg border border-neutral-100 bg-neutral-50/80 px-3 py-2"
            >
              <span className="font-medium text-brand-black">
                {log.old_status
                  ? `${employerStatusLabel(log.old_status)} → ${employerStatusLabel(log.new_status)}`
                  : employerStatusLabel(log.new_status)}
              </span>
              <span className="text-brand-black/60">
                {" "}
                · {log.changed_by_name ?? "Public submission"} ·{" "}
                {formatPortalDateTime(log.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
