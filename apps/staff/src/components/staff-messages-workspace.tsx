"use client";

import { formatPortalDateTime } from "@wayfinder/branding";
import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ThreadSummary = {
  threadId: string;
  clientId: string | null;
  clientLabel: string | null;
  esName: string | null;
  overdue: boolean;
  lastPreview: string | null;
};

type MessageRow = {
  id: string;
  body: string;
  sender_role: string;
  created_at: string;
  sender_name?: string | null;
};

export function StaffMessagesWorkspace() {
  const router = useRouter();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [body, setBody] = useState("");
  const [role, setRole] = useState<string>("es");
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/messages/threads");
    const data = (await res.json()) as {
      threads?: ThreadSummary[];
      role?: string;
      readOnly?: boolean;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      setLoading(false);
      return;
    }
    setThreads(data.threads ?? []);
    setRole(data.role ?? "es");
    setReadOnly(Boolean(data.readOnly));
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/messages/thread?id=${encodeURIComponent(threadId)}`);
    const data = (await res.json()) as { messages?: MessageRow[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setMessages(data.messages ?? []);
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (activeId) {
      void loadMessages(activeId);
    }
  }, [activeId, loadMessages]);

  async function send() {
    if (!activeId || !body.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: activeId, body: body.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      }
      setBody("");
      await loadMessages(activeId);
      await loadThreads();
      router.refresh();
    } catch (e) {
      setError(friendlyClientError(e));
    } finally {
      setBusy(false);
    }
  }

  async function dismissOverdue(threadId: string) {
    await fetch("/api/messages/dismiss-sla", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    });
    await loadThreads();
  }

  if (loading) {
    return <p className="text-sm text-brand-black/60">Loading messages…</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(240px,320px)_1fr]">
      <aside className="rounded-xl border border-neutral-200 bg-white p-3">
        <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-brand-black/55">
          Conversations
        </h2>
        <ul className="mt-2 space-y-1">
          {threads.length === 0 ? (
            <li className="px-2 py-4 text-sm text-brand-black/55">No threads yet.</li>
          ) : (
            threads.map((t) => (
              <li key={t.threadId}>
                <button
                  type="button"
                  onClick={() => setActiveId(t.threadId)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    activeId === t.threadId ? "bg-brand-green/10 text-brand-green" : "hover:bg-neutral-50"
                  }`}
                >
                  <span className="font-medium">{t.clientLabel ?? "Client"}</span>
                  {t.overdue ? (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
                      Needs reply
                    </span>
                  ) : null}
                  {t.lastPreview ? (
                    <span className="mt-0.5 block truncate text-xs text-brand-black/50">
                      {t.lastPreview}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        {!activeId ? (
          <p className="text-sm text-brand-black/60">Select a conversation.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-brand-black">
                {threads.find((t) => t.threadId === activeId)?.clientLabel ?? "Client"}
              </h2>
              {role === "supervisor" && !readOnly && threads.find((t) => t.threadId === activeId)?.overdue ? (
                <button
                  type="button"
                  onClick={() => dismissOverdue(activeId)}
                  className="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-semibold text-brand-black hover:bg-neutral-50"
                >
                  Clear this alert
                </button>
              ) : null}
            </div>

            <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.sender_role === "client"
                      ? "mr-12 bg-white border border-neutral-200"
                      : "ml-12 bg-brand-green/10"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-black/50">
                    {m.sender_role === "client"
                      ? (m.sender_name ?? "Client")
                      : m.sender_role === "supervisor"
                        ? `${m.sender_name ?? "Supervisor"} · Supervisor`
                        : (m.sender_name ?? "You")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                  <time className="mt-1 block text-xs text-brand-black/45" dateTime={m.created_at}>
                    {formatPortalDateTime(m.created_at)}
                  </time>
                </div>
              ))}
            </div>

            {readOnly ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Read-only preview — exit preview to reply.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={2}
                  placeholder="Reply to client…"
                  disabled={busy}
                  className="min-h-[2.75rem] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-brand-green focus:ring-2"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={busy || !body.trim()}
                  className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            )}
          </>
        )}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </section>
    </div>
  );
}
