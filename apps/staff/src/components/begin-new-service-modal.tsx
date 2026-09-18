"use client";

import { filterGaReferralServiceLabels } from "@/lib/feature-toggles";
import { GA_REFERRAL_SERVICE_LABELS } from "@wayfinder/supabase/referral-services";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type FilePayload = { name: string; mimeType: string; data: string } | null;

async function fileToPayload(file: File | null): Promise<FilePayload> {
  if (!file) return null;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
  const commaIdx = dataUrl.indexOf(",");
  const meta = dataUrl.substring(5, dataUrl.indexOf(";"));
  const base64 = dataUrl.substring(commaIdx + 1);
  return {
    name: file.name,
    mimeType: meta || file.type || "application/octet-stream",
    data: base64,
  };
}

type FormState = {
  counselorName: string;
  counselorEmail: string;
  counselorPhone: string;
  service: string;
  clientName: string;
  dob: string;
  clientPhone: string;
  clientPhone2: string;
  clientAddress: string;
  clientEmail: string;
  gender: string;
  ethnicity: string;
  disability: string;
  workGoal: string;
  meetingOption: string;
  counselorAvailability: string;
};

const emptyForm: FormState = {
  counselorName: "",
  counselorEmail: "",
  counselorPhone: "",
  service: "",
  clientName: "",
  dob: "",
  clientPhone: "",
  clientPhone2: "",
  clientAddress: "",
  clientEmail: "",
  gender: "",
  ethnicity: "",
  disability: "",
  workGoal: "",
  meetingOption: "",
  counselorAvailability: "",
};

type Props = {
  priorClientId: string | null;
  onClose: () => void;
  onCreated: (clientId: string) => void;
};

export function BeginNewServiceModal({ priorClientId, onClose, onCreated }: Props) {
  const open = Boolean(priorClientId);
  const [state, setState] = useState<"GA" | "TN">("GA");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [referralDateLabel, setReferralDateLabel] = useState("");
  const [priorOutcomeLabel, setPriorOutcomeLabel] = useState<string | null>(null);
  const [priorReferredAt, setPriorReferredAt] = useState<string | null>(null);
  const [openIntakeWarning, setOpenIntakeWarning] = useState<
    Array<{ id: string; full_name: string | null; intake_status: string }>
  >([]);
  const [authFile, setAuthFile] = useState<File | null>(null);
  const [otherFile, setOtherFile] = useState<File | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggles, setToggles] = useState({
    traditionalSupportedEmploymentEnabled: false,
    jobCoachingEnabled: false,
  });

  useEffect(() => {
    if (!open || !priorClientId) return;
    setError(null);
    setLoadingDraft(true);
    setForm(emptyForm);
    setAuthFile(null);
    setOtherFile(null);
    void (async () => {
      try {
        const [draftRes, toggleRes, openRes] = await Promise.all([
          fetch(
            `/api/referrals/prior-enrollment?priorClientId=${encodeURIComponent(priorClientId)}`
          ),
          fetch("/api/staff/feature-toggles"),
          fetch(
            `/api/referrals/open-intake-warning?priorClientId=${encodeURIComponent(priorClientId)}`
          ),
        ]);
        const draftData = (await draftRes.json()) as {
          error?: string;
          draft?: FormState;
          state?: "GA" | "TN";
          referralDate?: string;
          priorOutcomeLabel?: string | null;
          priorReferredAt?: string | null;
        };
        if (!draftRes.ok) throw new Error(draftData.error || "Could not load prior enrollment");

        const toggleData = (await toggleRes.json()) as {
          traditional_supported_employment_enabled?: boolean;
          job_coaching_enabled?: boolean;
        };
        if (toggleRes.ok) {
          setToggles({
            traditionalSupportedEmploymentEnabled:
              toggleData.traditional_supported_employment_enabled === true,
            jobCoachingEnabled: toggleData.job_coaching_enabled === true,
          });
        }

        setState("GA");
        setForm({ ...emptyForm, ...(draftData.draft ?? {}) });
        const openData = (await openRes.json()) as {
          open?: Array<{ id: string; full_name: string | null; intake_status: string }>;
        };
        setOpenIntakeWarning(openRes.ok ? (openData.open ?? []) : []);
        setPriorOutcomeLabel(draftData.priorOutcomeLabel ?? null);
        setPriorReferredAt(draftData.priorReferredAt ?? null);
        const when = draftData.referralDate ? new Date(draftData.referralDate) : new Date();
        setReferralDateLabel(
          Number.isNaN(when.getTime()) ? new Date().toLocaleString() : when.toLocaleString()
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load prior enrollment");
      } finally {
        setLoadingDraft(false);
      }
    })();
  }, [open, priorClientId]);

  const services = useMemo(
    () => filterGaReferralServiceLabels(GA_REFERRAL_SERVICE_LABELS, toggles),
    [toggles]
  );

  if (!open || !priorClientId) return null;

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.counselorName.trim() || !form.counselorEmail.trim()) {
      setError("Counselor name and email are required.");
      return;
    }
    if (!form.service) {
      setError("Select the service for this new enrollment.");
      return;
    }
    if (!form.clientName.trim()) {
      setError("Client name is required.");
      return;
    }

    setBusy(true);
    try {
      const [authorizations, otherDocs] = await Promise.all([
        fileToPayload(authFile),
        fileToPayload(otherFile),
      ]);
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          fromPriorClientId: priorClientId,
          ...form,
          authorizations,
          otherDocs,
        }),
      });
      const data = (await res.json()) as { error?: string; clientId?: string };
      if (!res.ok) throw new Error(data.error || "Could not add to referral queue");
      onCreated(data.clientId || "");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to referral queue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-3xl rounded-xl border border-neutral-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-brand-black">Begin New Service</h2>
            <p className="mt-1 text-sm text-brand-black/65">
              Review information from the prior enrollment, choose the new service, and add the client
              to the Referral Queue. Enter the authorization number and assign ES/TS on the queue row
              like any other referral.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-brand-black/60 hover:bg-neutral-50"
          >
            Close
          </button>
        </div>

        {loadingDraft ? (
          <p className="px-5 py-8 text-sm text-brand-black/60">Loading prior enrollment…</p>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="space-y-6 px-5 py-5">
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {error}
              </p>
            ) : null}

            {openIntakeWarning.length > 0 ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <p className="font-medium">Another open referral may exist for this person</p>
                <ul className="mt-1 list-inside list-disc text-xs">
                  {openIntakeWarning.map((o) => (
                    <li key={o.id}>
                      {o.full_name || o.id} ({o.intake_status})
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs">You can still add this enrollment to the queue.</p>
              </div>
            ) : null}

            <div className="rounded-lg border border-brand-green/25 bg-brand-green/5 px-3 py-2 text-sm text-brand-black/80">
              {priorOutcomeLabel ? (
                <p>
                  Prior enrollment outcome: <strong>{priorOutcomeLabel}</strong>
                </p>
              ) : null}
              {priorReferredAt ? (
                <p className="mt-1 text-xs text-brand-black/60">
                  Previous referral date: {new Date(priorReferredAt).toLocaleString()}
                </p>
              ) : null}
              <p className="mt-1">
                New referral date: <strong>{referralDateLabel || "Today"}</strong>
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="font-medium">State</span>
                <select
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                  value={state}
                  disabled
                >
                  <option value="GA">Georgia (GVRA)</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="font-medium">Service for new enrollment *</span>
                <select
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                  value={form.service}
                  onChange={(e) => update("service", e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {services.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <section>
              <h3 className="text-sm font-semibold text-brand-black">Counselor Information</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">
                  <span className="font-medium">Counselor Full Name *</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.counselorName}
                    onChange={(e) => update("counselorName", e.target.value)}
                    required
                  />
                </label>
                <label className="text-sm">
                  <span className="font-medium">Counselor Email *</span>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.counselorEmail}
                    onChange={(e) => update("counselorEmail", e.target.value)}
                    required
                  />
                </label>
                <label className="text-sm">
                  <span className="font-medium">Counselor Phone</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.counselorPhone}
                    onChange={(e) => update("counselorPhone", e.target.value)}
                  />
                </label>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-brand-black">Client Referral</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">
                  <span className="font-medium">Client Full Legal Name *</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.clientName}
                    onChange={(e) => update("clientName", e.target.value)}
                    required
                  />
                </label>
                <label className="text-sm">
                  <span className="font-medium">Date Of Birth</span>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.dob}
                    onChange={(e) => update("dob", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="font-medium">Email Address</span>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.clientEmail}
                    onChange={(e) => update("clientEmail", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="font-medium">Primary Phone</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.clientPhone}
                    onChange={(e) => update("clientPhone", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="font-medium">Secondary Phone</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.clientPhone2}
                    onChange={(e) => update("clientPhone2", e.target.value)}
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="font-medium">Address</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.clientAddress}
                    onChange={(e) => update("clientAddress", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="font-medium">Gender</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.gender}
                    onChange={(e) => update("gender", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="font-medium">Ethnicity/Race</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.ethnicity}
                    onChange={(e) => update("ethnicity", e.target.value)}
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="font-medium">Disability/History</span>
                  <textarea
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.disability}
                    onChange={(e) => update("disability", e.target.value)}
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="font-medium">Work Goal</span>
                  <textarea
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.workGoal}
                    onChange={(e) => update("workGoal", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="font-medium">Meeting Option</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.meetingOption}
                    onChange={(e) => update("meetingOption", e.target.value)}
                  >
                    <option value="">Select…</option>
                    <option value="In-Person">In-Person</option>
                    <option value="Zoom">Zoom</option>
                    <option value="Any of the Above">Any Of The Above</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="font-medium">Counselor Availability</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={form.counselorAvailability}
                    onChange={(e) => update("counselorAvailability", e.target.value)}
                  />
                </label>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-brand-black">Attachments (optional)</h3>
              <p className="mt-1 text-xs text-brand-black/55">
                Authorization can also be entered on the queue row after saving.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="font-medium">Authorizations</span>
                  <input
                    type="file"
                    className="mt-1 w-full text-sm"
                    onChange={(e) => setAuthFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <label className="text-sm">
                  <span className="font-medium">Other Documents</span>
                  <input
                    type="file"
                    className="mt-1 w-full text-sm"
                    onChange={(e) => setOtherFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </section>

            <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Add to Referral Queue"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
