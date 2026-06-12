"use client";

import { personDisplayName, staffDisplayName } from "@wayfinder/branding";
import { useMemo, useState } from "react";

export type ServiceOption = { id: string; name: string };
export type OfficeOption = { id: string; name: string };
export type CounselorOption = {
  id: string;
  full_name: string;
  office_id: string;
  offices: { name: string } | null;
};

export type EsUserOption = { id: string; label: string };

type AddClientModalProps = {
  open: boolean;
  onClose: () => void;
  services: ServiceOption[];
  offices: OfficeOption[];
  counselors: CounselorOption[];
  onCreated?: () => void;
  createEndpoint?: string;
  esUsers?: EsUserOption[];
};

export function AddClientModal({
  open,
  onClose,
  services,
  offices,
  counselors,
  onCreated,
  createEndpoint = "/api/es/clients",
  esUsers,
}: AddClientModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [officeId, setOfficeId] = useState(offices[0]?.id ?? "");
  const [counselorId, setCounselorId] = useState("");
  const [esUserId, setEsUserId] = useState(esUsers?.[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counselorsForOffice = useMemo(
    () => counselors.filter((c) => c.office_id === officeId),
    [counselors, officeId]
  );

  if (!open) {
    return null;
  }

  function resetAndClose() {
    setName("");
    setEmail("");
    setServiceId(services[0]?.id ?? "");
    setOfficeId(offices[0]?.id ?? "");
    setCounselorId("");
    setEsUserId(esUsers?.[0]?.id ?? "");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(createEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          serviceId,
          officeId,
          counselorId,
          ...(esUsers ? { esUserId: esUserId || undefined } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      onCreated?.();
      resetAndClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog backdrop"
        onClick={() => !submitting && resetAndClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-client-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="add-client-title" className="text-lg font-semibold text-brand-black">
            Add client
          </h2>
          <button
            type="button"
            onClick={() => !submitting && resetAndClose()}
            className="rounded-lg px-2 py-1 text-sm text-brand-black/60 hover:bg-neutral-100 hover:text-brand-black"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-brand-black/70">
          We&apos;ll email the client a login link so they can sign in to their portal.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-black" htmlFor="client-name">
              Client name
            </label>
            <input
              id="client-name"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-black" htmlFor="client-email">
              Email
            </label>
            <input
              id="client-email"
              type="email"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-black" htmlFor="service">
              Service
            </label>
            <select
              id="service"
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
              value={serviceId}
              onChange={(ev) => setServiceId(ev.target.value)}
              required
            >
              {services.length === 0 ? (
                <option value="">No services available</option>
              ) : (
                services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-black" htmlFor="office">
              Office
            </label>
            <select
              id="office"
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
              value={officeId}
              onChange={(ev) => {
                setOfficeId(ev.target.value);
                setCounselorId("");
              }}
              required
            >
              {offices.length === 0 ? (
                <option value="">No offices configured</option>
              ) : (
                offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-black" htmlFor="counselor">
              Counselor
            </label>
            <select
              id="counselor"
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
              value={counselorId}
              onChange={(ev) => setCounselorId(ev.target.value)}
              required
            >
              <option value="">Select a counselor</option>
              {counselorsForOffice.map((c) => (
                <option key={c.id} value={c.id}>
                  {personDisplayName({ full_name: c.full_name, id: c.id })}
                  {c.offices?.name ? ` · ${c.offices.name}` : ""}
                </option>
              ))}
            </select>
          </div>
          {esUsers && esUsers.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-brand-black" htmlFor="es-user">
                Assign to ES (optional)
              </label>
              <select
                id="es-user"
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
                value={esUserId}
                onChange={(ev) => setEsUserId(ev.target.value)}
              >
                <option value="">Unassigned</option>
                {esUsers.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => !submitting && resetAndClose()}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-brand-black hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || services.length === 0 || offices.length === 0}
              className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-gold/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Create client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
