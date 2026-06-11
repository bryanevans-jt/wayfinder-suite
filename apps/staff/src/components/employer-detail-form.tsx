"use client";

import type { EmployerRow, OfficeOption } from "@/components/community-partners-workspace";
import { EMPLOYER_STATUSES, employerStatusLabel } from "@/lib/employer-constants";
import {
  categoryFromDb,
  EmployerPositionNeedFields,
} from "@/components/employer-position-need-fields";
import { employmentCategoryLabel } from "@wayfinder/branding";
import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  employer: EmployerRow;
  offices: OfficeOption[];
  readOnly?: boolean;
  canDelete?: boolean;
};

export function EmployerDetailForm({
  employer,
  offices,
  readOnly = false,
  canDelete = false,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    name: employer.name,
    status: employer.status,
    industry: employer.industry ?? "",
    contact_name: employer.contact_name ?? "",
    contact_email: employer.contact_email ?? "",
    contact_phone: employer.contact_phone ?? "",
    address_line1: employer.address_line1 ?? "",
    address_line2: employer.address_line2 ?? "",
    city: employer.city ?? "",
    state: employer.state ?? "GA",
    zip: employer.zip ?? "",
    website: employer.website ?? "",
    notes: employer.notes ?? "",
    office_id: employer.office_id ?? "",
    position_need_primary: categoryFromDb(employer.position_need_primary),
    position_need_primary_other: employer.position_need_primary_other ?? "",
    position_need_secondary: categoryFromDb(employer.position_need_secondary),
    position_need_secondary_other: employer.position_need_secondary_other ?? "",
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/employers/${employer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          office_id: form.office_id || null,
          position_need_primary: form.position_need_primary || null,
          position_need_secondary: form.position_need_secondary || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
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
      <dl className="mt-6 grid max-w-2xl gap-4 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="font-medium text-brand-black/55">Business address</dt>
          <dd className="text-brand-black">
            {[
              form.address_line1,
              form.address_line2,
              [form.city, form.state, form.zip].filter(Boolean).join(", "),
            ]
              .filter(Boolean)
              .join(", ") || "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-brand-black/55">Primary position type</dt>
          <dd className="text-brand-black">
            {employmentCategoryLabel(form.position_need_primary, form.position_need_primary_other)}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-brand-black/55">Secondary position type</dt>
          <dd className="text-brand-black">
            {employmentCategoryLabel(
              form.position_need_secondary,
              form.position_need_secondary_other
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-brand-black/55">Status</dt>
          <dd className="text-brand-black">{employerStatusLabel(form.status)}</dd>
        </div>
        <div>
          <dt className="font-medium text-brand-black/55">Industry</dt>
          <dd className="text-brand-black">{form.industry || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-brand-black/55">Primary contact</dt>
          <dd className="text-brand-black">{form.contact_name || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-brand-black/55">Email</dt>
          <dd className="text-brand-black">{form.contact_email || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-brand-black/55">Phone</dt>
          <dd className="text-brand-black">{form.contact_phone || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-brand-black/55">Website</dt>
          <dd className="text-brand-black">{form.website || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-brand-black/55">Notes</dt>
          <dd className="whitespace-pre-wrap text-brand-black">{form.notes || "—"}</dd>
        </div>
      </dl>
    );
  }

  return (
    <form onSubmit={save} className="mt-6 max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Company name *</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Status</span>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            {EMPLOYER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {employerStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Industry</span>
          <input
            value={form.industry}
            onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Street address</span>
          <input
            value={form.address_line1}
            onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Suite / unit (optional)</span>
          <input
            value={form.address_line2}
            onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">City</span>
          <input
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">State</span>
          <select
            value={form.state}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="GA">GA</option>
            <option value="TN">TN</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">ZIP code</span>
          <input
            value={form.zip}
            onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <div className="sm:col-span-2">
          <EmployerPositionNeedFields
            primaryCategory={form.position_need_primary}
            primaryOther={form.position_need_primary_other}
            secondaryCategory={form.position_need_secondary}
            secondaryOther={form.position_need_secondary_other}
            onPrimaryCategory={(v) => setForm((f) => ({ ...f, position_need_primary: v }))}
            onPrimaryOther={(v) => setForm((f) => ({ ...f, position_need_primary_other: v }))}
            onSecondaryCategory={(v) => setForm((f) => ({ ...f, position_need_secondary: v }))}
            onSecondaryOther={(v) => setForm((f) => ({ ...f, position_need_secondary_other: v }))}
          />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Primary contact</span>
          <input
            value={form.contact_name}
            onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Contact email</span>
          <input
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Contact phone</span>
          <input
            value={form.contact_phone}
            onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Website</span>
          <input
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Office</span>
          <select
            value={form.office_id}
            onChange={(e) => setForm((f) => ({ ...f, office_id: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="">— None —</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Notes</span>
          <textarea
            rows={4}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || deleting}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Save changes
        </button>
        {canDelete ? (
          <button
            type="button"
            disabled={busy || deleting}
            onClick={async () => {
              if (
                !window.confirm(
                  `Delete ${employer.name}? This cannot be undone. Applications will lose their employer link.`
                )
              ) {
                return;
              }
              setDeleting(true);
              setError(null);
              try {
                const res = await fetch(`/api/employers/${employer.id}`, { method: "DELETE" });
                const data = (await res.json()) as { error?: string };
                if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                router.push("/dashboard/community-partners");
                router.refresh();
              } catch (err) {
                setError(friendlyClientError(err));
              } finally {
                setDeleting(false);
              }
            }}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete partner"}
          </button>
        ) : null}
        {saved ? <span className="text-sm text-brand-green">Saved.</span> : null}
        {error ? <span className="text-sm text-red-700">{error}</span> : null}
      </div>
    </form>
  );
}
