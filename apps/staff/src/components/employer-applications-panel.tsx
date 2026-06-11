import { applicationStatusLabel } from "@wayfinder/branding";
import { formatPortalDateTime } from "@/lib/portal-datetime";
import Link from "next/link";

export type EmployerApplicationRow = {
  id: string;
  status: string | null;
  company_name: string | null;
  created_at: string;
  client_id: string;
  client_label: string;
};

type Props = {
  applications: EmployerApplicationRow[];
  scopeLabel?: string;
};

export function EmployerApplicationsPanel({
  applications,
  scopeLabel = "your assigned clients",
}: Props) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Client applications
      </h2>
      <p className="mt-1 text-xs text-brand-black/60">
        Applications linked to this employer from {scopeLabel}.
      </p>

      {applications.length === 0 ? (
        <p className="mt-4 text-sm text-brand-black/70">
          No applications linked yet. When you record an application for a client and select this
          employer, it will appear here.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-brand-black/65">
                <th className="px-2 py-2 font-semibold">Client</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 font-semibold">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((row) => (
                <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-2 py-2">
                    <Link
                      href={`/dashboard/clients/${row.client_id}`}
                      className="font-medium text-brand-black underline decoration-brand-green/40 underline-offset-2 hover:decoration-brand-green"
                    >
                      {row.client_label}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-brand-black">
                    {applicationStatusLabel(row.status)}
                  </td>
                  <td className="px-2 py-2 text-brand-black/70">
                    {formatPortalDateTime(row.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
