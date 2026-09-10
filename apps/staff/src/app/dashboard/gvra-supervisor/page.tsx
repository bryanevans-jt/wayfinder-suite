import Link from "next/link";
import { StaffSupportNote } from "@/components/staff-support-note";
import {
  loadGvraSupervisorOfficesForSession,
  requireGvraSupervisorSession,
} from "@/lib/app-session";
import { loadGvraSupervisorCounselors } from "@/lib/gvra-supervisor-portal-data";
import { STAFF_SUPPORT_EMAIL, STAFF_SUPPORT_MAILTO } from "@/lib/support-contact";

const GA_REFERRAL_FORM_URL =
  process.env.NEXT_PUBLIC_GA_REFERRAL_FORM_URL ??
  "https://www.thejoshuatree.org/georgia-vocational-rehabilitation-referrals";

export default async function GvraSupervisorPortalPage() {
  const { session } = await requireGvraSupervisorSession();
  const { admin, officeIds } = await loadGvraSupervisorOfficesForSession(session);

  if (!admin) {
    return (
      <main className="px-6 py-10">
        <p className="text-sm text-red-800">Could not load your workspace.</p>
      </main>
    );
  }

  const [{ data: offices }, counselors] = await Promise.all([
    officeIds.length
      ? admin.from("offices").select("id, name").in("id", officeIds).order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    loadGvraSupervisorCounselors(admin, session.effectiveUserId),
  ]);

  const officeNameById = new Map((offices ?? []).map((o) => [o.id, o.name]));

  const counselorsByOffice = new Map<string, typeof counselors>();
  for (const counselor of counselors) {
    for (const officeId of counselor.office_ids) {
      const list = counselorsByOffice.get(officeId) ?? [];
      list.push(counselor);
      counselorsByOffice.set(officeId, list);
    }
  }

  return (
    <main className="px-6 py-10" aria-labelledby="gvra-supervisor-heading">
      <header className="max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
          GVRA Supervisor Portal
        </p>
        <h1 id="gvra-supervisor-heading" className="mt-1 text-3xl font-semibold text-brand-green">
          Counselors &amp; Clients
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-black/80">
          View counselors and clients in your assigned GVRA offices. Open a counselor to see their
          client list and activity — the same read-only view counselors receive. You can also{" "}
          <a
            href={GA_REFERRAL_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/80"
          >
            submit a referral
          </a>{" "}
          at any time.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/dashboard/help" className="font-medium text-brand-green hover:underline">
            Help
          </Link>
        </p>
      </header>

      {officeIds.length === 0 ? (
        <div className="mt-10 max-w-xl space-y-3 text-brand-black/75">
          <p>
            Your account is not linked to a GVRA office yet. Contact{" "}
            <a
              href={STAFF_SUPPORT_MAILTO}
              className="font-medium text-brand-green underline underline-offset-2"
            >
              {STAFF_SUPPORT_EMAIL}
            </a>{" "}
            for access.
          </p>
          <StaffSupportNote />
        </div>
      ) : counselors.length === 0 ? (
        <div className="mt-10 max-w-xl space-y-3 text-brand-black/75">
          <p>No counselors are assigned to your GVRA offices yet.</p>
          <StaffSupportNote />
        </div>
      ) : (
        <div className="mt-10 max-w-5xl space-y-10">
          {officeIds.map((officeId) => {
            const officeCounselors = counselorsByOffice.get(officeId) ?? [];
            if (officeCounselors.length === 0) return null;
            return (
              <section key={officeId} aria-labelledby={`office-${officeId}`}>
                <h2
                  id={`office-${officeId}`}
                  className="text-lg font-semibold text-brand-black"
                >
                  {officeNameById.get(officeId) ?? "GVRA Office"}
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {officeCounselors.map((counselor) => (
                    <li key={counselor.id}>
                      <Link
                        href={`/dashboard/gvra-supervisor/counselors/${counselor.id}`}
                        className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-brand-green/40 hover:shadow"
                      >
                        <p className="font-semibold text-brand-black">{counselor.full_name}</p>
                        {counselor.contact_email ? (
                          <p className="mt-1 text-xs text-brand-black/60">{counselor.contact_email}</p>
                        ) : null}
                        <p className="mt-3 text-sm text-brand-black/75">
                          <span className="font-medium text-brand-green">{counselor.client_count}</span>{" "}
                          client{counselor.client_count === 1 ? "" : "s"}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
