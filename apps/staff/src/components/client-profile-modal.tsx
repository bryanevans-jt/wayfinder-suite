"use client";

import { EmployerMatchPanel } from "@/components/employer-match-panel";
import { USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useEffect, useState } from "react";
import { ClientProfileForm, type ClientProfileData } from "@/components/client-profile-form";
import type { EmployerMatchResult } from "@/lib/employer-matching";

type Props = {
  clientId: string;
  clientLabel: string;
  open: boolean;
  onClose: () => void;
};

export function ClientProfileModal({ clientId, clientLabel, open, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ClientProfileData | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [employerMatches, setEmployerMatches] = useState<EmployerMatchResult[]>([]);
  const [missingGoals, setMissingGoals] = useState(false);
  const [missingGeocode, setMissingGeocode] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    void (async () => {
      const res = await fetch(`/api/clients/${clientId}/profile`);
      const data = (await res.json()) as {
        profile?: ClientProfileData;
        readOnly?: boolean;
        employerMatches?: EmployerMatchResult[];
        missingGoals?: boolean;
        missingGeocode?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? USER_FACING_SYSTEM_ERROR);
        setProfile(null);
      } else {
        setProfile(data.profile ?? null);
        setReadOnly(Boolean(data.readOnly));
        setEmployerMatches(data.employerMatches ?? []);
        setMissingGoals(Boolean(data.missingGoals));
        setMissingGeocode(Boolean(data.missingGeocode));
      }
      setLoading(false);
    })();
  }, [open, clientId]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-brand-black">Contact & employment goals</h2>
            <p className="text-sm text-brand-black/65">{clientLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-brand-black/60 hover:bg-neutral-100"
          >
            Close
          </button>
        </div>
        <div className="mt-4 space-y-6">
          {loading ? (
            <p className="text-sm text-brand-black/60">Loading…</p>
          ) : error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : profile ? (
            <>
              <ClientProfileForm clientId={clientId} initial={profile} readOnly={readOnly} />
              <EmployerMatchPanel
                matches={employerMatches}
                missingGoals={missingGoals}
                missingGeocode={missingGeocode}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
