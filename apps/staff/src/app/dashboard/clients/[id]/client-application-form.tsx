"use client";

import { APPLICATION_STATUSES } from "@wayfinder/branding";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { addClientApplication, updateClientApplication } from "./actions";

type EmployerOption = { id: string; name: string };

type ExistingApp = {
  id: string;
  company_name: string | null;
  employer_id: string | null;
  employer_name: string | null;
  status: string | null;
  status_other_reason: string | null;
  notes: string | null;
};

type Props = {
  clientId: string;
  employers?: EmployerOption[];
  existing?: ExistingApp[];
};

export function ClientApplicationForm({
  clientId,
  employers = [],
  existing = [],
}: Props) {
  const router = useRouter();
  const [employerId, setEmployerId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [status, setStatus] = useState<string>(APPLICATION_STATUSES[0]);
  const [otherReason, setOtherReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const employerById = useMemo(
    () => new Map(employers.map((e) => [e.id, e.name])),
    [employers]
  );

  function onEmployerChange(id: string) {
    setEmployerId(id);
    if (id && employerById.has(id)) {
      setCompanyName(employerById.get(id)!);
    }
  }

  function save() {
    setError(null);
    const company = companyName.trim();
    if (!employerId && !company) {
      setError("Select an employer from the network or enter a company name.");
      return;
    }
    startTransition(async () => {
      const result = await addClientApplication(
        clientId,
        status,
        company,
        notes,
        status === "Other" ? otherReason : null,
        employerId || null
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEmployerId("");
      setCompanyName("");
      setNotes("");
      setOtherReason("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
          Record application
        </h2>
        <p className="mt-1 text-xs text-brand-black/60">
          Link to an employer in your network when possible. Log contact time separately when you
          assist with an application.
        </p>
        <div className="mt-3 space-y-3">
          {employers.length > 0 ? (
            <label className="block text-sm font-medium text-brand-black">
              Employer (from network)
              <select
                value={employerId}
                onChange={(e) => onEmployerChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
                disabled={pending}
              >
                <option value="">— Select or type company below —</option>
                {employers.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-sm font-medium text-brand-black">
            Company
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Distribution"
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
              disabled={pending}
            />
          </label>
          <label className="block text-sm font-medium text-brand-black" htmlFor="app-status">
            Status
            <select
              id="app-status"
              className="mt-1 w-full max-w-md rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={pending}
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {status === "Other" ? (
            <label className="block text-sm font-medium text-brand-black">
              Reason
              <input
                type="text"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Describe the status"
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
                disabled={pending}
              />
            </label>
          ) : null}
          <label className="block text-sm font-medium text-brand-black">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Role, location, follow-up details…"
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
              disabled={pending}
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white hover:bg-brand-gold/90 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Add application"}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>

      {existing.length > 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
            Update application status
          </h2>
          <ul className="mt-3 space-y-4">
            {existing.map((app) => (
              <ApplicationUpdateRow key={app.id} clientId={clientId} app={app} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ApplicationUpdateRow({
  clientId,
  app,
}: {
  clientId: string;
  app: ExistingApp;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(app.status ?? APPLICATION_STATUSES[0]);
  const [otherReason, setOtherReason] = useState(app.status_other_reason ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const label =
    app.employer_name?.trim() ||
    app.company_name?.trim() ||
    "Employer not specified";

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateClientApplication(
          clientId,
          app.id,
          status,
          status === "Other" ? otherReason : null
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
      }
    });
  }

  return (
    <li className="rounded-lg border border-neutral-100 bg-neutral-50/80 p-3">
      <p className="font-semibold text-brand-black">{label}</p>
      {app.employer_id ? (
        <p className="text-xs text-brand-black/55">Linked in Community Partners Network</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={pending}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {status === "Other" ? (
          <input
            type="text"
            value={otherReason}
            onChange={(e) => setOtherReason(e.target.value)}
            placeholder="Reason"
            className="min-w-[10rem] flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
            disabled={pending}
          />
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-brand-green px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Update
        </button>
      </div>
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </li>
  );
}
