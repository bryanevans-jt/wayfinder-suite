import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { canManageReferrals } from "@wayfinder/supabase/referral-intake";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { staffHomePath } from "@wayfinder/supabase/roles";
import { loadReferralExportRows } from "@/lib/referral-export-data";
import { ReferralDetailActions } from "@/components/referral-detail-actions";
import { ReferralInfoEditForm } from "@/components/referral-info-edit-form";

type PageProps = { params: Promise<{ id: string }> };

export default async function ReferralDetailPage({ params }: PageProps) {
  const session = await getAppSession();
  if (!session || !canManageReferrals(session.effectiveRole)) {
    redirect(staffHomePath(session?.effectiveRole ?? null));
  }

  const { id } = await params;
  const admin = createServiceRoleClient();
  const rows = await loadReferralExportRows(admin, [id]);
  const row = rows[0];
  if (!row) notFound();

  return (
    <main className="px-6 py-10">
      <p className="text-sm">
        <Link href="/dashboard/referrals" className="font-medium text-brand-green hover:underline">
          ← Referral Queue
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold text-brand-black">
        {row.full_name || row.contact_email || "Referral Detail"}
      </h1>
      <p className="mt-1 text-sm text-brand-black/70">
        {row.stageLabel}
        {row.referral_state ? ` · ${row.referral_state}` : ""}
        {row.serviceName ? ` · ${row.serviceName}` : ""}
      </p>

      <div className="mt-4">
        <ReferralDetailActions clientId={row.id} />
      </div>

      <section className="mt-8 max-w-3xl">
        <h2 className="text-lg font-semibold text-brand-black">Edit Client Info</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          HR Director, Admin, and Super Admin can update referral details here. Changes save into the
          same client record used by the Referral Queue.
        </p>
        <div className="mt-4">
          <ReferralInfoEditForm
            initial={{
              id: row.id,
              full_name: row.full_name,
              contact_email: row.contact_email,
              referral_state: row.referral_state,
              date_of_birth: row.date_of_birth,
              primary_phone: row.primary_phone,
              secondary_phone: row.secondary_phone,
              home_address_line1: row.home_address_line1,
              home_city: row.home_city,
              home_state: row.home_state,
              home_zip: row.home_zip,
              gender: row.gender,
              ethnicity: row.ethnicity,
              disability_history: row.disability_history,
              employment_goal_primary: row.employment_goal_primary,
              meeting_preference: row.meeting_preference,
              counselor_availability: row.counselor_availability,
              authorization_number: row.authorization_number,
              counselorName: row.counselorName,
              counselorEmail: row.counselorEmail,
              serviceName: row.serviceName,
              stageLabel: row.stageLabel,
              intake_status: row.intake_status,
              referred_at: row.referred_at,
              authorization_override_reason: row.authorization_override_reason,
            }}
          />
        </div>
      </section>

      <section className="mt-8 max-w-3xl">
        <h2 className="text-lg font-semibold text-brand-black">Attachments</h2>
        {row.documents.length === 0 ? (
          <p className="mt-2 text-sm text-brand-black/60">No documents uploaded.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {row.documents.map((d) => {
              const kindLabel =
                d.kind === "authorizations" ? "Authorizations" : "Other Documents";
              const viewHref = `/api/referrals/documents/${d.id}?disposition=inline`;
              const downloadHref = `/api/referrals/documents/${d.id}?disposition=attachment`;
              const mime = (d.mime_type || "").toLowerCase();
              const canPreview =
                mime.includes("pdf") ||
                mime.startsWith("image/") ||
                /\.(pdf|png|jpe?g|webp)$/i.test(d.file_name);

              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-brand-black/50">
                      {kindLabel}
                    </p>
                    <p className="truncate text-sm font-medium text-brand-black">{d.file_name}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canPreview ? (
                      <a
                        href={viewHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-brand-green hover:bg-neutral-50"
                      >
                        View
                      </a>
                    ) : null}
                    <a
                      href={downloadHref}
                      className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-green/90"
                    >
                      Download
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
