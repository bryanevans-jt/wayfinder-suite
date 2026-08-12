"use client";

import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useState } from "react";

type Note = {
  id: string;
  body: string;
  author_name: string;
  created_at: string;
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

export function ClientStaffNotesPanel({ clientId, canWrite }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/staff-notes`);
    const data = (await res.json()) as { notes?: Note[]; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
    }
    setNotes(data.notes ?? []);
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
    if (!canWrite || !body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/staff-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      const data = (await res.json()) as { note?: Note; error?: string };
      if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      if (data.note) {
        setNotes((prev) => [data.note!, ...prev]);
      }
      setBody("");
    } catch (err) {
      setError(friendlyClientError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Internal staff notes
      </h2>
      <p className="mt-1 text-xs text-brand-black/60">
        Visible to Super Admin, Admin, HR, Hospitality, Supervisors, and Employment Specialists.
        Not shown to clients, natural supports, or counselors.
      </p>

      {canWrite ? (
        <form onSubmit={save} className="mt-4 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="How services are going, follow-ups, or anything the team should know…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving || !body.trim()}
            className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add note"}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="mt-4 text-sm text-brand-black/60">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="mt-4 text-sm text-brand-black/60">No internal notes yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
              <p className="whitespace-pre-wrap text-sm text-brand-black">{n.body}</p>
              <p className="mt-1 text-xs text-brand-black/55">
                {n.author_name} · {formatWhen(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
