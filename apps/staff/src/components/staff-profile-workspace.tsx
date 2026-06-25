"use client";

import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { personDisplayName } from "@wayfinder/branding";
import { useCallback, useEffect, useState } from "react";

type ProfileForm = {
  first_name: string;
  last_name: string;
  phone: string;
  home_city: string;
  bio: string;
};

export function StaffProfileWorkspace() {
  const [form, setForm] = useState<ProfileForm>({
    first_name: "",
    last_name: "",
    phone: "",
    home_city: "",
    bio: "",
  });
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/profile");
    const data = (await res.json()) as {
      profile?: ProfileForm & { full_name?: string | null };
      email?: string | null;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
    }
    const p = (data.profile ?? {}) as ProfileForm & { full_name?: string | null };
    setForm({
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      phone: p.phone ?? "",
      home_city: p.home_city ?? "",
      bio: p.bio ?? "",
    });
    setDisplayName(
      personDisplayName({
        full_name: p.full_name,
        first_name: p.first_name,
        last_name: p.last_name,
      })
    );
    setEmail(data.email ?? null);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (e) {
        setError(friendlyClientError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { profile?: { full_name?: string | null }; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      }
      setDisplayName(
        personDisplayName({
          full_name: data.profile?.full_name,
          first_name: form.first_name,
          last_name: form.last_name,
        })
      );
      setMessage("Profile saved. Your name will appear across Wayfinder apps.");
    } catch (err) {
      setError(friendlyClientError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-brand-black/60">Loading profile…</p>;
  }

  return (
    <div className="mt-8 max-w-xl space-y-6">
      <p className="text-sm text-brand-black/75">
        This name is used on reports, messages, and team views. Only your city is stored — not a
        full home address.
      </p>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-brand-green/30 bg-brand-green/5 px-3 py-2 text-sm text-brand-black">
          {message}
        </p>
      ) : null}

      <form onSubmit={(e) => void save(e)} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
        {email ? (
          <p className="text-sm text-brand-black/70">
            Sign-in email: <span className="font-medium text-brand-black">{email}</span>
          </p>
        ) : null}
        {displayName ? (
          <p className="text-sm text-brand-black/70">
            Display name: <span className="font-medium text-brand-black">{displayName}</span>
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-brand-black">First name</span>
            <input
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
              autoComplete="given-name"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-brand-black">Last name</span>
            <input
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
              autoComplete="family-name"
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-brand-black">Phone</span>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            autoComplete="tel"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-brand-black">Home city</span>
          <input
            value={form.home_city}
            onChange={(e) => setForm((f) => ({ ...f, home_city: e.target.value }))}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            placeholder="City only — no street address"
            autoComplete="address-level2"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-brand-black">Bio (optional)</span>
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            rows={4}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            placeholder="A short note for your team, if you choose to share one."
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}
