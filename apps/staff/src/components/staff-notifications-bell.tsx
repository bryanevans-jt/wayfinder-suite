"use client";

import { formatPortalDateTime } from "@/lib/portal-datetime";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
};

export function StaffNotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = (await res.json()) as {
        notifications?: NotificationRow[];
        unread?: number;
      };
      if (res.ok) {
        setNotifications(data.notifications ?? []);
        setUnread(data.unread ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }
  }, [open]);

  async function markRead(ids: string[]) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    void load();
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    void load();
  }

  return (
    <div ref={panelRef} className="relative px-3 pb-3">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        className="relative flex w-full items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-brand-black hover:bg-neutral-50"
        aria-expanded={open}
        aria-label="Notifications"
      >
        <span>Notifications</span>
        {unread > 0 ? (
          <span className="rounded-full bg-brand-gold px-2 py-0.5 text-xs font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute left-3 right-3 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-black/55">
              In-app
            </span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-brand-green hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {loading && notifications.length === 0 ? (
            <p className="px-3 py-4 text-sm text-brand-black/60">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-4 text-sm text-brand-black/60">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {notifications.map((n) => (
                <li key={n.id} className={n.read_at ? "opacity-70" : ""}>
                  {n.link_path ? (
                    <Link
                      href={n.link_path}
                      onClick={() => {
                        if (!n.read_at) void markRead([n.id]);
                        setOpen(false);
                      }}
                      className="block px-3 py-3 hover:bg-neutral-50"
                    >
                      <p className="text-sm font-semibold text-brand-black">{n.title}</p>
                      {n.body ? (
                        <p className="mt-0.5 text-xs text-brand-black/70 line-clamp-2">{n.body}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-brand-black/50">
                        {formatPortalDateTime(n.created_at)}
                      </p>
                    </Link>
                  ) : (
                    <div className="px-3 py-3">
                      <p className="text-sm font-semibold text-brand-black">{n.title}</p>
                      {n.body ? (
                        <p className="mt-0.5 text-xs text-brand-black/70">{n.body}</p>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
