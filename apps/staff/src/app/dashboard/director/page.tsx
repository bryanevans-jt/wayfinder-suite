import Link from "next/link";
import { buildRendezvousAppUrl } from "@wayfinder/branding";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isDirectorRole,
  isTransitionDirectorRole,
  isVocationalDirectorRole,
  roleDisplayName,
  staffHomePath,
} from "@wayfinder/supabase/roles";
import { directorVisibleStaffRoles } from "@wayfinder/supabase/director-scope";
import { redirect } from "next/navigation";

export default async function DirectorHomePage() {
  const session = await getAppSession();
  if (!session) redirect("/login");
  const role = session.effectiveRole;
  if (!isDirectorRole(role)) {
    redirect(staffHomePath(role));
  }

  const scopeRoles = directorVisibleStaffRoles(role);
  const scopeLabels = scopeRoles.map((r) => roleDisplayName(r)).join(", ");

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-black/50">
          View only
        </p>
        <h1 className="mt-1 text-3xl font-bold text-brand-green">{roleDisplayName(role)}</h1>
        <p className="mt-3 text-brand-black/70">
          You can review caseloads, contact logs, time entries, and KRA numbers for{" "}
          <span className="font-medium text-brand-black">{scopeLabels}</span>
          {isTransitionDirectorRole(role) ? ", plus Pre-ETS records" : ""}. You cannot create,
          edit, delete, reassign, or approve anything.
        </p>
      </div>

      <ul className="space-y-3">
        <li>
          <Link
            href="/dashboard/clients"
            className="block rounded-2xl border border-brand-green/20 bg-white px-5 py-4 font-semibold text-brand-green shadow-sm hover:border-brand-green/40"
          >
            Clients &amp; caseloads
          </Link>
        </li>
        <li>
          <Link
            href="/dashboard/billable-hours"
            className="block rounded-2xl border border-brand-green/20 bg-white px-5 py-4 font-semibold text-brand-green shadow-sm hover:border-brand-green/40"
          >
            Billable hours / KRA
          </Link>
        </li>
        {isTransitionDirectorRole(role) ? (
          <li>
            <Link
              href="/dashboard/pre-ets"
              className="block rounded-2xl border border-brand-green/20 bg-white px-5 py-4 font-semibold text-brand-green shadow-sm hover:border-brand-green/40"
            >
              Pre-ETS
            </Link>
          </li>
        ) : null}
        {isVocationalDirectorRole(role) ? (
          <li className="rounded-2xl border border-dashed border-brand-green/25 bg-brand-green/5 px-5 py-4 text-sm text-brand-black/65">
            Vocational services in scope: supported employment, IJP, WRT, and job coaching via client
            and billable-hour views.
          </li>
        ) : null}
        <li>
          <a
            href={buildRendezvousAppUrl("/calendar")}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl border border-brand-green/20 bg-white px-5 py-4 font-semibold text-brand-green shadow-sm hover:border-brand-green/40"
          >
            Rendezvous Team Calendar
          </a>
        </li>
      </ul>
    </main>
  );
}
