import {
  applicationStatusLabel,
  isGoldApplicationStatus,
} from "@wayfinder/branding";
import { buildClientActivityFkIds, createServerClient, resolveDashboardClient } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";

type Props = {
  selectedClientId?: string;
};

export async function ClientApplicationsCard({ selectedClientId }: Props) {
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

  const { data: clientForFk } = await supabase
    .from("clients")
    .select("id, user_id, profile_id")
    .eq("id", ctx.clientId)
    .maybeSingle();

  const fkIds = clientForFk ? buildClientActivityFkIds(clientForFk) : [ctx.clientId];

  const { data: applications } = await supabase
    .from("applications")
    .select("id, company_name, status, status_other_reason, updated_at, created_at")
    .in("client_id", fkIds)
    .order("updated_at", { ascending: false });

  const rows = applications ?? [];

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-green">Applications</h2>
      <p className="mt-1 text-sm text-brand-black/70">
        Job applications your employment specialist has logged for you.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-brand-black/60">No applications logged yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((app) => {
            const status = applicationStatusLabel(app.status);
            const gold = isGoldApplicationStatus(app.status);
            return (
              <li
                key={app.id as string}
                className="rounded-xl border border-neutral-200 bg-brand-white px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-brand-black">
                    {(app.company_name as string)?.trim() || "Employer not specified"}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                      gold
                        ? "bg-brand-gold/15 text-brand-gold"
                        : "bg-brand-green/10 text-brand-green"
                    }`}
                  >
                    {status}
                  </span>
                </div>
                {(app.status as string)?.trim().toLowerCase() === "other" &&
                (app.status_other_reason as string)?.trim() ? (
                  <p className="mt-1 text-sm text-brand-black/75">
                    Reason: {app.status_other_reason as string}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
