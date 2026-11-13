"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPE_LABELS,
  type FeedbackStatus,
  type FeedbackType,
} from "@/lib/feedback";

type Submission = {
  id: string;
  created_at: string;
  updated_at: string;
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_role: string | null;
  feedback_type: FeedbackType;
  title: string;
  description: string;
  page_url: string | null;
  app_version: string | null;
  attachment_path: string | null;
  status: FeedbackStatus;
  decision_notes: string | null;
};

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function FeedbackAdminList({ highlightId = null }: { highlightId?: string | null }) {
  const [rows, setRows] = useState<Submission[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/feedback?${params}`);
      const data = (await res.json()) as { submissions?: Submission[]; error?: string };
      if (!res.ok) {
        setError(data.error || "Unable to load feedback.");
        setRows([]);
        return;
      }
      setRows(data.submissions ?? []);
    } catch {
      setError("Unable to load feedback.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: FeedbackStatus) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json()) as { submission?: Submission; error?: string };
      if (!res.ok) {
        setError(data.error || "Could not update status.");
        return;
      }
      setRows((prev) =>
        prev.map((row) => (row.id === id && data.submission ? { ...row, ...data.submission } : row))
      );
    } catch {
      setError("Could not update status.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-brand-black/70">
          Status{" "}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ml-2 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {FEEDBACK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {FEEDBACK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50"
        >
          Refresh
        </button>
      </div>

      {loading ? <p className="text-sm text-brand-black/60">Loading…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-brand-black/60">
          No feedback submissions yet.
        </p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((row) => {
          const highlighted = highlightId === row.id;
          return (
            <li
              key={row.id}
              id={`feedback-${row.id}`}
              className={`rounded-2xl border bg-white p-4 shadow-sm ${
                highlighted ? "border-brand-green ring-2 ring-brand-green/20" : "border-neutral-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-black/45">
                    {FEEDBACK_TYPE_LABELS[row.feedback_type] ?? row.feedback_type}
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-brand-black">{row.title}</h2>
                  <p className="mt-1 text-xs text-brand-black/55">
                    {row.submitter_name || "Team member"}
                    {row.submitter_role ? ` · ${row.submitter_role}` : ""}
                    {row.submitter_email ? ` · ${row.submitter_email}` : ""}
                    {" · "}
                    {formatWhen(row.created_at)}
                  </p>
                </div>
                <label className="text-sm text-brand-black/70">
                  Status
                  <select
                    className="ml-2 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                    value={row.status}
                    disabled={savingId === row.id}
                    onChange={(e) => void updateStatus(row.id, e.target.value as FeedbackStatus)}
                  >
                    {FEEDBACK_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {FEEDBACK_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-brand-black/80">{row.description}</p>
              <p className="mt-2 text-xs text-brand-black/50">
                {row.page_url ? `Page: ${row.page_url}` : "Page: (not captured)"}
                {row.app_version ? ` · App ${row.app_version}` : ""}
                {row.attachment_path ? " · Attachment on file" : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
