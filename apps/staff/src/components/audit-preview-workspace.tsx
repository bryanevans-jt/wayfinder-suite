"use client";

import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useState } from "react";

type RoleOption = { id: string; label: string };
type UserOption = { id: string; label: string; email: string | null };

export function AuditPreviewWorkspace() {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/preview/users");
    const data = (await res.json()) as { roles?: RoleOption[]; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
    }
    setRoles(data.roles ?? []);
  }, []);

  const loadUsers = useCallback(async (nextRole: string) => {
    if (!nextRole) {
      setUsers([]);
      return;
    }
    setError(null);
    const res = await fetch(`/api/preview/users?role=${encodeURIComponent(nextRole)}`);
    const data = (await res.json()) as { users?: UserOption[]; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
    }
    setUsers(data.users ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadRoles();
      } catch (e) {
        setError(friendlyClientError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadRoles]);

  useEffect(() => {
    if (!role) {
      setUsers([]);
      setUserId("");
      return;
    }
    void loadUsers(role).catch((e) => {
      setError(friendlyClientError(e));
    });
  }, [role, loadUsers]);

  async function startPreview() {
    if (!userId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/preview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
        credentials: "include",
      });
      const data = (await res.json()) as { redirectUrl?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      }
      window.location.href = data.redirectUrl ?? "/dashboard";
    } catch (e) {
      setError(friendlyClientError(e));
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-brand-black/60">Loading audit preview…</p>;
  }

  return (
    <section className="mt-8 max-w-xl space-y-6">
      <div className="rounded-xl border border-brand-green/25 bg-brand-green/5 p-5 text-sm text-brand-black/80">
        <p>
          Open a <strong>read-only</strong> view of another user&apos;s dashboard to troubleshoot
          or verify their experience. The target user is not notified. Enter and exit events are
          logged internally for super admins only.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-brand-black">Role / account type</span>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setUserId("");
            }}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="">Select a role…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-brand-black">User</span>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={!role || users.length === 0}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 disabled:opacity-50"
          >
            <option value="">
              {!role ? "Choose a role first" : users.length === 0 ? "No active users" : "Select a user…"}
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={busy || !userId}
          onClick={() => void startPreview()}
          className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Starting preview…" : "Start preview"}
        </button>
      </div>
    </section>
  );
}
