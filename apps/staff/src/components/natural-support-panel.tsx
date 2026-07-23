"use client";

import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useState, useTransition } from "react";

const RELATIONSHIPS = [
  { value: "parent", label: "Parent" },
  { value: "guardian", label: "Guardian" },
  { value: "spouse", label: "Spouse" },
  { value: "family", label: "Family" },
  { value: "other", label: "Other" },
] as const;

export type NaturalSupportContact = {
  id: string;
  full_name: string;
  email: string;
  relationship: string;
  relationship_other: string | null;
  invited_at: string | null;
};

type Props = {
  clientId: string;
  clientLabel?: string;
  /** Optional SSR seed; panel refreshes from API on mount. */
  initialContacts?: NaturalSupportContact[];
  compact?: boolean;
  onInvited?: () => void;
};

export function NaturalSupportPanel({
  clientId,
  clientLabel,
  initialContacts,
  compact = false,
  onInvited,
}: Props) {
  const [contacts, setContacts] = useState<NaturalSupportContact[]>(initialContacts ?? []);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState<string>("parent");
  const [relationshipOther, setRelationshipOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialContacts);
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/natural-support?clientId=${encodeURIComponent(clientId)}`);
    const data = (await res.json()) as { contacts?: NaturalSupportContact[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      setLoading(false);
      return;
    }
    setContacts(data.contacts ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/natural-support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            fullName,
            email,
            relationship,
            relationshipOther: relationship === "other" ? relationshipOther : null,
          }),
        });
        const data = (await res.json()) as {
          contacts?: NaturalSupportContact[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
        }
        setContacts(data.contacts ?? []);
        setFullName("");
        setEmail("");
        setRelationshipOther("");
        onInvited?.();
      } catch (e) {
        setError(friendlyClientError(e));
      }
    });
  }

  function beginEditEmail(contact: NaturalSupportContact) {
    setError(null);
    setEditingId(contact.id);
    setEditEmail(contact.email);
  }

  function cancelEditEmail() {
    setEditingId(null);
    setEditEmail("");
  }

  async function saveEditEmail(contactId: string) {
    setError(null);
    setSavingEmail(true);
    try {
      const res = await fetch("/api/natural-support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          contactId,
          email: editEmail,
        }),
      });
      const data = (await res.json()) as {
        contacts?: NaturalSupportContact[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      }
      setContacts(data.contacts ?? []);
      setEditingId(null);
      setEditEmail("");
    } catch (e) {
      setError(friendlyClientError(e));
    } finally {
      setSavingEmail(false);
    }
  }

  return (
    <div className={compact ? "" : "rounded-xl border border-neutral-200 bg-white p-4"}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Natural Support
        {clientLabel ? (
          <span className="ml-2 font-normal normal-case text-brand-black/70">· {clientLabel}</span>
        ) : null}
      </h2>
      <p className="mt-1 text-xs text-brand-black/60">
        Parent, guardian, or family member with read-only access to this client&apos;s dashboard.
        Sends a magic-link invite. You can update an email if it was entered incorrectly during
        onboarding.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-brand-black/55">Loading contacts…</p>
      ) : contacts.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm">
          {contacts.map((c) => (
            <li key={c.id} className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-brand-black">{c.full_name}</span>
                <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-xs uppercase text-brand-green">
                  {c.relationship}
                </span>
                {c.invited_at ? (
                  <span className="text-xs text-brand-black/45">Invited</span>
                ) : null}
              </div>
              {editingId === c.id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="min-w-[12rem] flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                    disabled={savingEmail}
                    aria-label={`Email for ${c.full_name}`}
                  />
                  <button
                    type="button"
                    onClick={() => void saveEditEmail(c.id)}
                    disabled={savingEmail || !editEmail.trim() || !editEmail.includes("@")}
                    className="rounded-lg border border-brand-green bg-white px-3 py-1.5 text-xs font-semibold text-brand-green hover:bg-brand-green/5 disabled:opacity-60"
                  >
                    {savingEmail ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditEmail}
                    disabled={savingEmail}
                    className="rounded-lg px-3 py-1.5 text-xs text-brand-black/60 hover:bg-neutral-100 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-brand-black/60">{c.email}</span>
                  <button
                    type="button"
                    onClick={() => beginEditEmail(c)}
                    disabled={pending || savingEmail}
                    className="text-xs font-medium text-brand-green hover:underline disabled:opacity-60"
                  >
                    Edit email
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-brand-black/55">No Natural Support contacts yet.</p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-brand-black sm:col-span-2">
          Name
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            disabled={pending}
          />
        </label>
        <label className="block text-sm font-medium text-brand-black sm:col-span-2">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            disabled={pending}
          />
        </label>
        <label className="block text-sm font-medium text-brand-black">
          Relationship
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            disabled={pending}
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {relationship === "other" ? (
          <label className="block text-sm font-medium text-brand-black">
            Specify
            <input
              type="text"
              value={relationshipOther}
              onChange={(e) => setRelationshipOther(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              disabled={pending}
            />
          </label>
        ) : null}
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={pending || !fullName.trim() || !email.trim()}
        className="mt-4 rounded-lg border border-brand-green bg-white px-4 py-2 text-sm font-semibold text-brand-green hover:bg-brand-green/5 disabled:opacity-60"
      >
        {pending ? "Inviting…" : "Invite Natural Support"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
