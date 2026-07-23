"use client";

import { EmployerPositionNeedFields } from "@/components/employer-position-need-fields";
import { COMMUNITY_PARTNERS_NETWORK_NAME } from "@/lib/employer-constants";
import type { EmploymentCategory } from "@wayfinder/branding";
import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useEffect, useState } from "react";

export function CommunityPartnersJoinForm() {
  const [issuedAt, setIssuedAt] = useState<number | null>(null);
  const [formToken, setFormToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "",
    industry: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "GA",
    zip: "",
    website: "",
    notes: "",
    company_fax: "",
    position_need_primary: "" as EmploymentCategory | "",
    position_need_primary_other: "",
    position_need_secondary: "" as EmploymentCategory | "",
    position_need_secondary_other: "",
  });

  useEffect(() => {
    void fetch("/api/community-partners/form-token")
      .then((r) => r.json())
      .then((d: { issuedAt?: number; token?: string }) => {
        if (typeof d.issuedAt === "number" && typeof d.token === "string") {
          setIssuedAt(d.issuedAt);
          setFormToken(d.token);
        }
      })
      .catch(() => {
        setIssuedAt(null);
        setFormToken(null);
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (issuedAt == null || formToken == null) {
      setError("Form is still loading. Please wait a moment.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/community-partners/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, issuedAt, token: formToken }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      setSuccess(true);
    } catch (err) {
      setError(friendlyClientError(err));
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-8 text-center">
        <h2 className="text-xl font-semibold text-brand-black">Thank You!</h2>
        <p className="mt-3 text-brand-black/80">
          Your request to join the {COMMUNITY_PARTNERS_NETWORK_NAME} was received. Our team will
          review your information and follow up soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Company fax
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.company_fax}
            onChange={(e) => setForm((f) => ({ ...f, company_fax: e.target.value }))}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-brand-black">Company name *</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-brand-black">Industry</span>
          <input
            value={form.industry}
            onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-brand-black">Street address *</span>
          <input
            required
            value={form.address_line1}
            onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-brand-black">Suite / unit (optional)</span>
          <input
            value={form.address_line2}
            onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-brand-black">City *</span>
          <input
            required
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-brand-black">State *</span>
          <select
            required
            value={form.state}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="GA">GA</option>
            <option value="TN">TN</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-brand-black">ZIP code *</span>
          <input
            required
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
          <span className="font-medium text-brand-black">Primary contact *</span>
          <input
            required
            value={form.contact_name}
            onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-brand-black">Contact email *</span>
          <input
            required
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-brand-black">Contact phone</span>
          <input
            value={form.contact_phone}
            onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-brand-black">Website</span>
          <input
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-brand-black">Notes (optional)</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Tell us about your hiring needs or partnership interest"
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={busy || issuedAt == null || formToken == null}
        className="w-full rounded-lg bg-brand-green px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Submitting…" : "Submit join request"}
      </button>
    </form>
  );
}
