"use client";

import { EmployerPositionNeedFields } from "@/components/employer-position-need-fields";
import {
  COMMUNITY_PARTNERS_NETWORK_NAME,
  EMPLOYER_STATUSES,
  employerStatusBadgeClass,
  employerStatusLabel,
} from "@/lib/employer-constants";
import {
  RESPONSIVE_TABLE_CLASS,
  ResponsiveTableShell,
} from "@/components/responsive-table-shell";
import { supabaseEmbedName } from "@/lib/supabase-embed";
import { EMPLOYMENT_CATEGORIES, EMPLOYMENT_CATEGORY_LABELS, type EmploymentCategory } from "@wayfinder/branding";
import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const CommunityPartnersMap = dynamic(
  () =>
    import("@/components/community-partners-map").then((m) => ({
      default: m.CommunityPartnersMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(70vh,560px)] items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-brand-black/60">
        Loading map…
      </div>
    ),
  }
);

type ViewMode = "list" | "map";

export type OfficeOption = { id: string; name: string };

export type EmployerRow = {
  id: string;
  name: string;
  status: string;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city: string | null;
  state: string | null;
  zip?: string | null;
  website: string | null;
  office_id: string | null;
  notes?: string | null;
  position_need_primary?: string | null;
  position_need_primary_other?: string | null;
  position_need_secondary?: string | null;
  position_need_secondary_other?: string | null;
  submission_source?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  offices?: { name: string } | { name: string }[] | null;
};

type Props = {
  offices: OfficeOption[];
  readOnly?: boolean;
  readOnlyReason?: "preview" | "role";
  isAdminTier?: boolean;
  initialEmployers?: EmployerRow[];
  lastTouchByEmployer?: Record<
    string,
    { touchedAt: string; touchedByName: string | null; outcome: string | null }
  >;
};

export function CommunityPartnersWorkspace({
  offices,
  readOnly = false,
  readOnlyReason = "preview",
  isAdminTier = false,
  initialEmployers = [],
  lastTouchByEmployer = {},
}: Props) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [employers, setEmployers] = useState<EmployerRow[]>(initialEmployers);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [loading, setLoading] = useState(initialEmployers.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: "",
    status: "active",
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
    office_id: "",
    position_need_primary: "" as EmploymentCategory | "",
    position_need_primary_other: "",
    position_need_secondary: "" as EmploymentCategory | "",
    position_need_secondary_other: "",
  });

  const loadEmployers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (cityFilter.trim()) params.set("city", cityFilter.trim());
    if (stateFilter) params.set("state", stateFilter);
    if (positionFilter) params.set("position", positionFilter);
    const res = await fetch(`/api/employers?${params.toString()}`);
    const data = (await res.json()) as { employers?: EmployerRow[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      setEmployers([]);
    } else {
      setEmployers(data.employers ?? []);
    }
    setLoading(false);
  }, [query, statusFilter, cityFilter, stateFilter, positionFilter]);

  useEffect(() => {
    void loadEmployers();
  }, [loadEmployers]);

  async function createEmployer(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/employers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          office_id: form.office_id || null,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      setShowAdd(false);
      setForm({
        name: "",
        status: "active",
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
        office_id: "",
        position_need_primary: "",
        position_need_primary_other: "",
        position_need_secondary: "",
        position_need_secondary_other: "",
      });
      if (data.id) {
        router.push(`/dashboard/community-partners/${data.id}`);
      } else {
        await loadEmployers();
        router.refresh();
      }
    } catch (err) {
      setError(friendlyClientError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {readOnly ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {readOnlyReason === "preview"
            ? "Read-only preview — exit preview to add or edit community partners."
            : "View-only access — contact an Employment Specialist or administrator to add or edit partners."}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex shrink-0 gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              viewMode === "list"
                ? "bg-white text-brand-black shadow-sm"
                : "text-brand-black/65 hover:text-brand-black"
            }`}
          >
            List view
          </button>
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              viewMode === "map"
                ? "bg-white text-brand-black shadow-sm"
                : "text-brand-black/65 hover:text-brand-black"
            }`}
          >
            Map view
          </button>
        </div>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-brand-black/70">Search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, contact, industry, office…"
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex min-w-[120px] flex-col gap-1 text-sm">
          <span className="font-medium text-brand-black/70">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="">All</option>
            {EMPLOYER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {employerStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        {isAdminTier ? (
          <>
            <label className="flex min-w-[120px] flex-col gap-1 text-sm">
              <span className="font-medium text-brand-black/70">City</span>
              <input
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                placeholder="e.g. Atlanta"
                className="rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
            <label className="flex min-w-[90px] flex-col gap-1 text-sm">
              <span className="font-medium text-brand-black/70">State</span>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2"
              >
                <option value="">All</option>
                <option value="GA">GA</option>
                <option value="TN">TN</option>
              </select>
            </label>
            <label className="flex min-w-[140px] flex-col gap-1 text-sm">
              <span className="font-medium text-brand-black/70">Employment need</span>
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2"
              >
                <option value="">All</option>
                {EMPLOYMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {EMPLOYMENT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        {!readOnly ? (
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white hover:bg-brand-gold/90"
          >
            {showAdd ? "Cancel" : "Add employer"}
          </button>
        ) : null}
      </div>

      {showAdd && !readOnly ? (
        <form
          onSubmit={createEmployer}
          className="max-w-3xl space-y-4 rounded-xl border border-neutral-200 bg-white p-5"
        >
          <h2 className="text-lg font-semibold text-brand-black">New Employer</h2>
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
                onSecondaryCategory={(v) =>
                  setForm((f) => ({ ...f, position_need_secondary: v }))
                }
                onSecondaryOther={(v) =>
                  setForm((f) => ({ ...f, position_need_secondary_other: v }))
                }
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
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Save employer
          </button>
        </form>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {viewMode === "map" ? (
        loading ? (
          <div className="flex h-[min(70vh,560px)] items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-brand-black/60">
            Loading employers…
          </div>
        ) : (
          <CommunityPartnersMap employers={employers} />
        )
      ) : (
      <ResponsiveTableShell>
        <table className={RESPONSIVE_TABLE_CLASS}>
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="px-4 py-3 font-semibold text-brand-black">Employer</th>
              <th className="px-4 py-3 font-semibold text-brand-black">Status</th>
              <th className="px-4 py-3 font-semibold text-brand-black">Contact</th>
              <th className="px-4 py-3 font-semibold text-brand-black">Location</th>
              <th className="px-4 py-3 font-semibold text-brand-black">Last touched</th>
              <th className="px-4 py-3 font-semibold text-brand-black">Office</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brand-black/60">
                  Loading employers…
                </td>
              </tr>
            ) : employers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-brand-black/70">
                  No employers yet. Add a hiring partner or share the public join link.
                </td>
              </tr>
            ) : (
              employers.map((row) => {
                const officeName = supabaseEmbedName(row.offices) ?? "—";
                const location = [row.city, row.state].filter(Boolean).join(", ") || "—";
                return (
                  <tr
                    key={row.id}
                    className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/80"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/community-partners/${row.id}`}
                        className="font-medium text-brand-black underline decoration-brand-green/40 underline-offset-2 hover:decoration-brand-green"
                      >
                        {row.name}
                      </Link>
                      {row.industry ? (
                        <p className="mt-0.5 text-xs text-brand-black/55">{row.industry}</p>
                      ) : null}
                      {row.submission_source === "public" ? (
                        <p className="mt-0.5 text-xs text-amber-800">Public submission</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${employerStatusBadgeClass(row.status)}`}
                      >
                        {employerStatusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-black">
                      <div>{row.contact_name ?? "—"}</div>
                      {row.contact_email ? (
                        <div className="text-xs text-brand-black/60">{row.contact_email}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-brand-black">{location}</td>
                    <td className="px-4 py-3 text-sm text-brand-black/80">
                      {(() => {
                        const touch = lastTouchByEmployer[row.id];
                        if (!touch) return <span className="text-brand-black/45">—</span>;
                        return (
                          <div>
                            <div>{new Date(touch.touchedAt).toLocaleDateString()}</div>
                            {touch.touchedByName ? (
                              <div className="text-xs text-brand-black/55">{touch.touchedByName}</div>
                            ) : null}
                            {touch.outcome ? (
                              <div className="text-xs text-brand-black/55 line-clamp-2">{touch.outcome}</div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-brand-black">{officeName}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ResponsiveTableShell>
      )}
    </div>
  );
}

/** @deprecated Use CommunityPartnersWorkspace */
export const EmployerNetworkWorkspace = CommunityPartnersWorkspace;
