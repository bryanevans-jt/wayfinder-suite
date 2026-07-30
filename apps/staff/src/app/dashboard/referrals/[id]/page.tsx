import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  canManageReferrals,
  intakeStatusLabel,
  referralStageLabel,
} from "@wayfinder/supabase/referral-intake";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { staffHomePath } from "@wayfinder/supabase/roles";
import { loadReferralExportRows, referralAddressLine } from "@/lib/referral-export-data";
import { ReferralDetailActions } from "@/components/referral-detail-actions";

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

  const fields: Array<{ label: string; value: string }> = [
    { label: "Stage", value: referralStageLabel({ intakeStatus: row.intake_status, stageTitle: row.stageName }) },
    { label: "Intake Status", value: intakeStatusLabel(row.intake_status) },
    { label: "State", value: row.referral_state || "—" },
    { label: "Service", value: row.serviceName || "—" },
    {
      label: "Referred",
      value: row.referred_at ? new Date(row.referred_at).toLocaleString() : "—",
    },
    { label: "Authorization #", value: row.authorization_number || "—" },
    { label: "Override Reason", value: row.authorization_override_reason || "—" },
    { label: "Counselor Name", value: row.counselorName || "—" },
    { label: "Counselor Email", value: row.counselorEmail || "—" },
    { label: "Counselor Availability", value: row.counselor_availability || "—" },
    { label: "Client Full Legal Name", value: row.full_name || "—" },
    { label: "Date Of Birth", value: row.date_of_birth || "—" },
    { label: "Primary Phone", value: row.primary_phone || "—" },
    { label: "Secondary Phone", value: row.secondary_phone || "—" },
    { label: "Address", value: referralAddressLine(row) || "—" },
    { label: "Email Address", value: row.contact_email || "—" },
    { label: "Gender", value: row.gender || "—" },
    { label: "Ethnicity/Race", value: row.ethnicity || "—" },
    { label: "Disability/History", value: row.disability_history || "—" },
    { label: "Work Goal", value: row.employment_goal_primary || "—" },
    { label: "Meeting Option", value: row.meeting_preference || "—" },
  ];

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
        <h2 className="text-lg font-semibold text-brand-black">Submitted Referral Info</h2>
        <dl className="mt-4 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          {fields.map((f) => (
            <div key={f.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
              <dt className="text-sm font-medium text-brand-black/70">{f.label}</dt>
              <dd className="text-sm text-brand-black whitespace-pre-wrap">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8 max-w-3xl">
        <h2 className="text-lg font-semibold text-brand-black">Attachments</h2>
        {row.documents.length === 0 ? (
          <p className="mt-2 text-sm text-brand-black/60">No documents uploaded.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {row.documents.map((d, i) => (
              <li key={`${d.file_name}-${i}`}>
                <span className="font-medium">
                  {d.kind === "authorizations" ? "Authorizations" : "Other Documents"}:
                </span>{" "}
                {d.file_name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
