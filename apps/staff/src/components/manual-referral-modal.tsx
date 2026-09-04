"use client";

import { filterGaReferralServiceLabels } from "@/lib/feature-toggles";
import { useEffect, useMemo, useState, type FormEvent } from "react";

const GA_SERVICES = [
  "Traditional Supported Employment",
  "Job Coaching",
  "Individual Job Placement",
  "Workplace Readiness Training",
] as const;

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

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (clientId: string) => void;
};

const emptyForm = {
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

export function ManualReferralModal({ open, onClose, onCreated }: Props) {
  const state = "GA" as const;
  const [form, setForm] = useState(emptyForm);
  const [authFile, setAuthFile] = useState<File | null>(null);
  const [otherFile, setOtherFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggles, setToggles] = useState({
    traditionalSupportedEmploymentEnabled: false,
    jobCoachingEnabled: false,
  });

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const res = await fetch("/api/staff/feature-toggles");
        const data = (await res.json()) as {
          traditional_supported_employment_enabled?: boolean;
          job_coaching_enabled?: boolean;
        };
        if (res.ok) {
          setToggles({
            traditionalSupportedEmploymentEnabled:
              data.traditional_supported_employment_enabled === true,
            jobCoachingEnabled: data.job_coaching_enabled === true,
          });
        }
      } catch {
        /* keep defaults: IJP + WRT only */
      }
    })();
  }, [open]);

  const services = useMemo(
    () => filterGaReferralServiceLabels(GA_SERVICES, toggles),
    [toggles]
  );

  if (!open) return null;

  function update<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.counselorName.trim() || !form.counselorEmail.trim() || !form.counselorPhone.trim()) {
      setError("Counselor name, email, and phone are required.");
      return;
    }
    if (!form.service) {
      setError("Select a service.");
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
          ...form,
          authorizations,
          otherDocs,
        }),
      });
      const data = (await res.json()) as { error?: string; clientId?: string };
      if (!res.ok) throw new Error(data.error || "Could not create referral");
      setForm(emptyForm);
      setAuthFile(null);
      setOtherFile(null);
      onCreated(data.clientId || "");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create referral");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-3xl rounded-xl border border-neutral-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-brand-black">Create Referral</h2>
            <p className="mt-1 text-sm text-brand-black/65">
              Manual entry enters the same Referral Queue workflow. No counselor confirmation or HR
              notification emails are sent.
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

        <form onSubmit={(e) => void submit(e)} className="space-y-6 px-5 py-5">
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              {error}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium">State *</span>
              <select
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                value={state}
                disabled
              >
                <option value="GA">Georgia (GVRA)</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium">Service Requested *</span>
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
                <span className="font-medium">Counselor Phone *</span>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                  value={form.counselorPhone}
                  onChange={(e) => update("counselorPhone", e.target.value)}
                  required
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
                  placeholder="e.g., Tuesdays after 2PM"
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-brand-black">Attachments</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="font-medium">
                  {state === "GA" ? "Authorizations" : "Documents"} (Optional)
                </span>
                <input
                  type="file"
                  className="mt-1 w-full text-sm"
                  onChange={(e) => setAuthFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="text-sm">
                <span className="font-medium">Other Documents (Optional)</span>
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
              {busy ? "Creating…" : "Create Referral"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
