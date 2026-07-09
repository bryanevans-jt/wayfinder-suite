"use client";

import { formatPortalDateTime } from "@wayfinder/branding";
import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type MessageRow = {
  id: string;
  body: string;
  sender_role: string;
  created_at: string;
  sender_name?: string | null;
};

type ThreadPayload = {
  threadId: string | null;
  esName: string | null;
  messages: MessageRow[];
};

export function ClientMessagesPanel() {
  const router = useRouter();
  const [thread, setThread] = useState<ThreadPayload | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/messages/thread");
      const data = (await res.json()) as ThreadPayload & { error?: string };
      if (!res.ok) {
        setError(data.error ?? USER_FACING_SYSTEM_ERROR);
        setLoading(false);
        return;
      }
      setThread(data);
    } catch (e) {
      setError(friendlyClientError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    const trimmed = body.trim();
    if (!trimmed) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      }
      setBody("");
      await load();
      router.refresh();
    } catch (e) {
      setError(friendlyClientError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-green">Message your ES</h2>
        <p className="mt-2 text-sm text-brand-black/60">Loading…</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-green">Message your ES</h2>
      <p className="mt-1 text-sm text-brand-black/70">
        {thread?.esName
          ? `Conversation with ${thread.esName}. Replies typically arrive within two business days.`
          : "Your Employment Specialist will appear here once assigned."}
      </p>

      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-neutral-100 bg-neutral-50/50 p-3">
        {(thread?.messages ?? []).length === 0 ? (
          <p className="text-sm text-brand-black/55">No messages yet. Say hello to get started.</p>
        ) : (
          (thread?.messages ?? []).map((m) => (
            <div
              key={m.id}
              className={`rounded-lg px-3 py-2 text-sm ${
                m.sender_role === "client"
                  ? "ml-8 bg-brand-green/10 text-brand-black"
                  : "mr-8 border border-neutral-200 bg-white text-brand-black"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-black/50">
                {m.sender_role === "client"
                  ? "You"
                  : m.sender_role === "supervisor"
                    ? `${m.sender_name ?? "Supervisor"} · Supervisor`
                    : (m.sender_name ?? "Employment Specialist")}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
              <time className="mt-1 block text-xs text-brand-black/45" dateTime={m.created_at}>
                {formatPortalDateTime(m.created_at)}
              </time>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Type your message…"
          disabled={busy}
          className="min-h-[2.75rem] flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none ring-brand-green focus:ring-2"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !body.trim()}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
