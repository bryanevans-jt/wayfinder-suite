"use client";

import {
  EMPLOYMENT_CATEGORIES,
  EMPLOYMENT_CATEGORY_LABELS,
  employmentCategoryLabel,
  type EmploymentCategory,
} from "@wayfinder/branding";
import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type ClientProfileData = {
  contact_email: string | null;
  home_address_line1: string | null;
  home_address_line2: string | null;
  home_city: string | null;
  home_state: string | null;
  home_zip: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
  primary_phone: string | null;
  secondary_phone: string | null;
  employment_goal_primary: string | null;
  employment_goal_primary_other: string | null;
  employment_goal_secondary: string | null;
  employment_goal_secondary_other: string | null;
};

type Props = {
  clientId: string;
  initial: ClientProfileData;
  readOnly?: boolean;
};

function categorySelectValue(value: string | null): EmploymentCategory | "" {
  const key = (value ?? "").trim().toLowerCase();
  if ((EMPLOYMENT_CATEGORIES as readonly string[]).includes(key)) {
    return key as EmploymentCategory;
  }
  return "";
}

export function ClientProfileForm({ clientId, initial, readOnly = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [geocoded, setGeocoded] = useState(
    initial.home_latitude != null && initial.home_longitude != null
  );

  const [form, setForm] = useState({
    contact_email: initial.contact_email ?? "",
    home_address_line1: initial.home_address_line1 ?? "",
    home_address_line2: initial.home_address_line2 ?? "",
    home_city: initial.home_city ?? "",
    home_state: initial.home_state ?? "GA",
    home_zip: initial.home_zip ?? "",
    primary_phone: initial.primary_phone ?? "",
    secondary_phone: initial.secondary_phone ?? "",
    employment_goal_primary: categorySelectValue(initial.employment_goal_primary),
    employment_goal_primary_other: initial.employment_goal_primary_other ?? "",
    employment_goal_secondary: categorySelectValue(initial.employment_goal_secondary),
    employment_goal_secondary_other: initial.employment_goal_secondary_other ?? "",
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/clients/${clientId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          employment_goal_primary: form.employment_goal_primary || null,
          employment_goal_secondary: form.employment_goal_secondary || null,
        }),
      });
      const data = (await res.json()) as { error?: string; geocoded?: boolean };
      if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      setGeocoded(Boolean(data.geocoded));
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(friendlyClientError(err));
    } finally {
      setBusy(false);
    }
  }

  if (readOnly) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
          Contact & Employment Goals
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="font-medium text-brand-black/55">Email</dt>
            <dd className="text-brand-black">{form.contact_email || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-brand-black/55">Home address</dt>
            <dd className="text-brand-black">
              {[
                form.home_address_line1,
                form.home_address_line2,
                [form.home_city, form.home_state, form.home_zip].filter(Boolean).join(", "),
              ]
                .filter(Boolean)
                .join(", ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-brand-black/55">Primary phone</dt>
            <dd className="text-brand-black">{form.primary_phone || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-brand-black/55">Secondary phone</dt>
            <dd className="text-brand-black">{form.secondary_phone || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-brand-black/55">Primary employment goal</dt>
            <dd className="text-brand-black">
              {employmentCategoryLabel(form.employment_goal_primary, form.employment_goal_primary_other)}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-brand-black/55">Secondary employment goal</dt>
            <dd className="text-brand-black">
              {employmentCategoryLabel(
                form.employment_goal_secondary,
                form.employment_goal_secondary_other
              )}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Contact & Employment Goals
      </h2>
      <p className="mt-1 text-xs text-brand-black/60">
        Email is used for the client login invite. Home address and employment goals power nearby
        employer matching in the Community Partners Network.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Email</span>
          <input
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Street address</span>
          <input
            value={form.home_address_line1}
            onChange={(e) => setForm((f) => ({ ...f, home_address_line1: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Apt / unit (optional)</span>
          <input
            value={form.home_address_line2}
            onChange={(e) => setForm((f) => ({ ...f, home_address_line2: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">City</span>
          <input
            value={form.home_city}
            onChange={(e) => setForm((f) => ({ ...f, home_city: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">State</span>
          <select
            value={form.home_state}
            onChange={(e) => setForm((f) => ({ ...f, home_state: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="GA">GA</option>
            <option value="TN">TN</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">ZIP code</span>
          <input
            value={form.home_zip}
            onChange={(e) => setForm((f) => ({ ...f, home_zip: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <div className="flex items-end text-xs text-brand-black/55">
          {geocoded ? (
            <span className="text-brand-green">Address geocoded for matching.</span>
          ) : (
            <span>Save a complete address to enable distance matching.</span>
          )}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Primary phone</span>
          <input
            type="tel"
            value={form.primary_phone}
            onChange={(e) => setForm((f) => ({ ...f, primary_phone: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Secondary phone (optional)</span>
          <input
            type="tel"
            value={form.secondary_phone}
            onChange={(e) => setForm((f) => ({ ...f, secondary_phone: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>

        <fieldset className="sm:col-span-2 space-y-3 rounded-lg border border-neutral-100 bg-neutral-50/60 p-3">
          <legend className="px-1 text-sm font-medium text-brand-black">Employment goals</legend>
          <GoalFields
            label="Primary employment goal"
            category={form.employment_goal_primary}
            other={form.employment_goal_primary_other}
            onCategory={(v) => setForm((f) => ({ ...f, employment_goal_primary: v }))}
            onOther={(v) => setForm((f) => ({ ...f, employment_goal_primary_other: v }))}
          />
          <GoalFields
            label="Secondary employment goal (optional)"
            category={form.employment_goal_secondary}
            other={form.employment_goal_secondary_other}
            onCategory={(v) => setForm((f) => ({ ...f, employment_goal_secondary: v }))}
            onOther={(v) => setForm((f) => ({ ...f, employment_goal_secondary_other: v }))}
          />
        </fieldset>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Save profile
        </button>
        {saved ? <span className="text-sm text-brand-green">Saved.</span> : null}
        {error ? <span className="text-sm text-red-700">{error}</span> : null}
      </div>
    </form>
  );
}

function GoalFields({
  label,
  category,
  other,
  onCategory,
  onOther,
}: {
  label: string;
  category: EmploymentCategory | "";
  other: string;
  onCategory: (value: EmploymentCategory | "") => void;
  onOther: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="font-medium">{label}</span>
        <select
          value={category}
          onChange={(e) => onCategory(e.target.value as EmploymentCategory | "")}
          className="rounded-lg border border-neutral-300 px-3 py-2"
        >
          <option value="">— Not set —</option>
          {EMPLOYMENT_CATEGORIES.map((key) => (
            <option key={key} value={key}>
              {EMPLOYMENT_CATEGORY_LABELS[key]}
            </option>
          ))}
        </select>
      </label>
      {category === "other" ? (
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Describe the goal</span>
          <input
            value={other}
            onChange={(e) => onOther(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2"
            placeholder="e.g. Landscaping"
          />
        </label>
      ) : null}
    </div>
  );
}
