"use client";

import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { CHECK_IN_OUTCOMES, checkInOutcomeLabel, type CheckInOutcome } from "@/lib/hospitality-check-ins";
import { useCallback, useEffect, useState } from "react";

type Contact = {
  id: string;
  contacted_at: string;
  contacted_by_name?: string;
  outcome: string;
  outcome_label: string;
  notes: string | null;
};

type Props = {
  clientId: string;
  canWrite: boolean;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function HospitalityCheckInPanel({ clientId, canWrite }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [monthLabel, setMonthLabel] = useState("");
  const [outcome, setOutcome] = useState<CheckInOutcome>("reached");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/hospitality/check-ins?clientId=${encodeURIComponent(clientId)}`);
    const data = (await res.json()) as {
      contacts?: Contact[];
      monthLabel?: string;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
    setContacts(data.contacts ?? []);
    setMonthLabel(data.monthLabel ?? "");
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load()
      .catch((err) => {
        if (!cancelled) setError(friendlyClientError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hospitality/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, outcome, notes: notes.trim() || null }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      setNotes("");
      setOutcome("reached");
      await load();
    } catch (err) {
      setError(friendlyClientError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Hospitality check-ins
      </h2>
      <p className="mt-1 text-xs text-brand-black/60">
        Monthly wellness calls. Goal: contact this client at least once in {monthLabel || "the current month"}.
      </p>

      {canWrite ? (
        <form onSubmit={save} className="mt-4 space-y-2">
          <label className="block text-sm">
            <span className="font-medium text-brand-black/70">Outcome</span>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as CheckInOutcome)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {CHECK_IN_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {checkInOutcomeLabel(o)}
                </option>
              ))}
            </select>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Optional notes from this call…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Log check-in"}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="mt-4 text-sm text-brand-black/60">Loading check-ins…</p>
      ) : contacts.length === 0 ? (
        <p className="mt-4 text-sm text-brand-black/60">No hospitality check-ins logged yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="text-sm">
              <span className="font-medium">{c.outcome_label}</span>
              <span className="text-brand-black/60">
                {" "}
                · {formatWhen(c.contacted_at)}
                {c.contacted_by_name ? ` · ${c.contacted_by_name}` : ""}
              </span>
              {c.notes ? <p className="mt-0.5 text-brand-black/80">{c.notes}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
