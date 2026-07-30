"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const GA_SERVICES = [
  "Traditional Supported Employment",
  "Job Coaching",
  "Individual Job Placement",
  "Workplace Readiness Training",
] as const;

const TN_SERVICES = [
  "Traditional Supported Employment",
  "Individual Job Placement",
  "Job Coaching",
  "Job Readiness Training",
] as const;

function serviceLabelFromName(state: string | null, serviceName: string | null): string {
  if (!serviceName) return "";
  const n = serviceName.toLowerCase();
  if (n.includes("workplace readiness")) return "Workplace Readiness Training";
  if (n.includes("job readiness")) return "Job Readiness Training";
  if (n.includes("job coaching")) return "Job Coaching";
  if (n.includes("individual job placement")) return "Individual Job Placement";
  if (n.includes("traditional supported employment") || n.includes("supported employment")) {
    return "Traditional Supported Employment";
  }
  const options = state === "TN" ? TN_SERVICES : GA_SERVICES;
  const hit = options.find((label) => n.includes(label.toLowerCase()));
  return hit ?? "";
}

export type ReferralInfoEditInitial = {
  id: string;
  full_name: string | null;
  contact_email: string | null;
  referral_state: string | null;
  date_of_birth: string | null;
  primary_phone: string | null;
  secondary_phone: string | null;
  home_address_line1: string | null;
  home_city: string | null;
  home_state: string | null;
  home_zip: string | null;
  gender: string | null;
  ethnicity: string | null;
  disability_history: string | null;
  employment_goal_primary: string | null;
  meeting_preference: string | null;
  counselor_availability: string | null;
  authorization_number: string | null;
  counselorName: string | null;
  counselorEmail: string | null;
  serviceName: string | null;
  stageLabel: string;
  intake_status: string;
  referred_at: string | null;
  authorization_override_reason: string | null;
};

type Props = {
  initial: ReferralInfoEditInitial;
};

export function ReferralInfoEditForm({ initial }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    fullName: initial.full_name ?? "",
    dateOfBirth: initial.date_of_birth ?? "",
    contactEmail: initial.contact_email ?? "",
    primaryPhone: initial.primary_phone ?? "",
    secondaryPhone: initial.secondary_phone ?? "",
    homeAddressLine1: initial.home_address_line1 ?? "",
    homeCity: initial.home_city ?? "",
    homeState: initial.home_state === "TN" || initial.home_state === "GA" ? initial.home_state : (initial.referral_state === "TN" ? "TN" : "GA"),
    homeZip: initial.home_zip ?? "",
    gender: initial.gender ?? "",
    ethnicity: initial.ethnicity ?? "",
    disabilityHistory: initial.disability_history ?? "",
    workGoal: initial.employment_goal_primary ?? "",
    meetingPreference: initial.meeting_preference ?? "",
    counselorAvailability: initial.counselor_availability ?? "",
    authorizationNumber: initial.authorization_number ?? "",
    referralState: (initial.referral_state === "TN" ? "TN" : "GA") as "GA" | "TN",
    counselorName: initial.counselorName ?? "",
    counselorEmail: initial.counselorEmail ?? "",
    serviceLabel: serviceLabelFromName(initial.referral_state, initial.serviceName),
  });

  const services = useMemo(
    () => (form.referralState === "TN" ? TN_SERVICES : GA_SERVICES),
    [form.referralState]
  );

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: initial.id,
          action: "update_info",
          info: {
            fullName: form.fullName,
            dateOfBirth: form.dateOfBirth,
            contactEmail: form.contactEmail,
            primaryPhone: form.primaryPhone,
            secondaryPhone: form.secondaryPhone,
            homeAddressLine1: form.homeAddressLine1,
            homeCity: form.homeCity,
            homeState: form.homeState,
            homeZip: form.homeZip,
            gender: form.gender,
            ethnicity: form.ethnicity,
            disabilityHistory: form.disabilityHistory,
            workGoal: form.workGoal,
            meetingPreference: form.meetingPreference,
            counselorAvailability: form.counselorAvailability,
            authorizationNumber: form.authorizationNumber,
            referralState: form.referralState,
            counselorName: form.counselorName,
            counselorEmail: form.counselorEmail,
            serviceLabel: form.serviceLabel || null,
          },
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} className="space-y-6">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm text-brand-black/75">
        <p>
          <span className="font-medium text-brand-black">Stage:</span> {initial.stageLabel}
          {initial.referred_at
            ? ` · Referred ${new Date(initial.referred_at).toLocaleString()}`
            : ""}
        </p>
        {initial.authorization_override_reason ? (
          <p className="mt-1">
            <span className="font-medium text-brand-black">Override Reason:</span>{" "}
            {initial.authorization_override_reason}
          </p>
        ) : null}
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-brand-black">Referral &amp; Service</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">State</span>
            <select
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.referralState}
              onChange={(e) => {
                const next = e.target.value as "GA" | "TN";
                setForm((prev) => ({ ...prev, referralState: next, serviceLabel: "" }));
              }}
            >
              <option value="GA">GA</option>
              <option value="TN">TN</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Service</span>
            <select
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.serviceLabel}
              onChange={(e) => update("serviceLabel", e.target.value)}
            >
              <option value="">Select…</option>
              {services.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-medium">Authorization #</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.authorizationNumber}
              onChange={(e) => update("authorizationNumber", e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-brand-black">Counselor Information</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="font-medium">Counselor Full Name</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.counselorName}
              onChange={(e) => update("counselorName", e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-medium">Counselor Email</span>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.counselorEmail}
              onChange={(e) => update("counselorEmail", e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-medium">Counselor Availability</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.counselorAvailability}
              onChange={(e) => update("counselorAvailability", e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-brand-black">Client Referral</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="font-medium">Client Full Legal Name *</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              required
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Date Of Birth</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.dateOfBirth}
              onChange={(e) => update("dateOfBirth", e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Email Address</span>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.contactEmail}
              onChange={(e) => update("contactEmail", e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Primary Phone</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.primaryPhone}
              onChange={(e) => update("primaryPhone", e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Secondary Phone</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.secondaryPhone}
              onChange={(e) => update("secondaryPhone", e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-medium">Street Address</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.homeAddressLine1}
              onChange={(e) => update("homeAddressLine1", e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">City</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.homeCity}
              onChange={(e) => update("homeCity", e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">State</span>
            <select
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.homeState}
              onChange={(e) => update("homeState", e.target.value)}
            >
              <option value="GA">GA</option>
              <option value="TN">TN</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">ZIP</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.homeZip}
              onChange={(e) => update("homeZip", e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Gender</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.gender}
              onChange={(e) => update("gender", e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Ethnicity/Race</span>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.ethnicity}
              onChange={(e) => update("ethnicity", e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-medium">Disability/History</span>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.disabilityHistory}
              onChange={(e) => update("disabilityHistory", e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-medium">Work Goal</span>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.workGoal}
              onChange={(e) => update("workGoal", e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Meeting Option</span>
            <select
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.meetingPreference}
              onChange={(e) => update("meetingPreference", e.target.value)}
            >
              <option value="">Select…</option>
              <option value="In-Person">In-Person</option>
              <option value="Zoom">Zoom</option>
              <option value="Any of the Above">Any Of The Above</option>
            </select>
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save Client Info"}
        </button>
        {saved ? <span className="text-sm text-brand-green">Saved.</span> : null}
        {error ? <span className="text-sm text-red-700">{error}</span> : null}
      </div>
    </form>
  );
}
