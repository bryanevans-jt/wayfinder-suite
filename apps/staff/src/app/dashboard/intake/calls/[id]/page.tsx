import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { canAccessHospitalityIntake } from "@wayfinder/supabase/referral-intake";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { staffHomePath } from "@wayfinder/supabase/roles";
import { INTAKE_CALLS_PATH } from "@/lib/staff-nav";
import { loadReferralExportRows } from "@/lib/referral-export-data";
import { loadHospitalityIntakeOptions } from "@/lib/hospitality-intake-options";
import { ReferralInfoEditForm } from "@/components/referral-info-edit-form";
import { HospitalityStartClientPanel } from "@/components/hospitality-start-client-panel";

type PageProps = { params: Promise<{ id: string }> };

export default async function IntakeCallDetailPage({ params }: PageProps) {
  const session = await getAppSession();
  if (!session || !canAccessHospitalityIntake(session.effectiveRole)) {
    redirect(staffHomePath(session?.effectiveRole ?? null));
  }

  const { id } = await params;
  const admin = createServiceRoleClient();
  const [rows, options, { data: esLinks }] = await Promise.all([
    loadReferralExportRows(admin, [id]),
    loadHospitalityIntakeOptions(admin),
    admin
      .from("es_client_assignments")
      .select("es_user_id")
      .eq("client_id", id)
      .limit(1),
  ]);
  const row = rows[0];
  if (!row) notFound();

  const initialEsUserId = (esLinks?.[0]?.es_user_id as string | undefined) ?? null;

  return (
    <main className="px-6 py-10">
      <p className="text-sm">
        <Link
          href={INTAKE_CALLS_PATH}
          className="font-medium text-brand-green hover:underline"
        >
          ← Intake Calls
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold text-brand-black">
        {row.full_name || row.contact_email || "Client Intake"}
      </h1>
      <p className="mt-1 text-sm text-brand-black/70">
        {row.stageLabel}
        {row.referral_state ? ` · ${row.referral_state}` : ""}
        {row.serviceName ? ` · ${row.serviceName}` : ""}
      </p>

      <section className="mt-8 max-w-3xl">
        <HospitalityStartClientPanel
          clientId={row.id}
          initialOfficeId={row.office_id}
          initialCounselorId={row.counselor_id}
          initialSupervisorUserId={row.supervisor_user_id}
          initialEsUserId={initialEsUserId}
          supervisors={options.supervisors}
          offices={options.offices}
          counselors={options.counselors}
          esUsers={options.esUsers}
        />
      </section>

      <section className="mt-8 max-w-3xl">
        <h2 className="text-lg font-semibold text-brand-black">Edit Referral Info</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Update submitted referral fields. Counselor name and email here also update the directory
          record if needed.
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
