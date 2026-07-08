"use client";

import { personDisplayName, servicesGroupedByState, flattenServiceGroups, type ServiceRowInput } from "@wayfinder/branding";
import { useEffect, useMemo, useState } from "react";
import { ServiceSelect } from "@/components/service-select";

export type OfficeOption = { id: string; name: string; state?: string | null };
export type CounselorOption = {
  id: string;
  full_name: string;
  office_id: string;
  /** All offices this counselor belongs to (primary + assignments). */
  office_ids?: string[];
  offices: { name: string } | null;
  is_active?: boolean;
};

export type EsUserOption = { id: string; label: string };

type AddClientModalProps = {
  open: boolean;
  onClose: () => void;
  serviceCatalog: ServiceRowInput[];
  offices: OfficeOption[];
  counselors: CounselorOption[];
  onCreated?: () => void;
  createEndpoint?: string;
  esUsers?: EsUserOption[];
  allowEsEmail?: boolean;
};

export function AddClientModal({
  open,
  onClose,
  serviceCatalog,
  offices,
  counselors,
  onCreated,
  createEndpoint = "/api/es/clients",
  esUsers,
  allowEsEmail = false,
}: AddClientModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [officeId, setOfficeId] = useState(offices[0]?.id ?? "");
  const [serviceId, setServiceId] = useState("");
  const [counselorId, setCounselorId] = useState("");
  const [esUserId, setEsUserId] = useState(esUsers?.[0]?.id ?? "");
  const [esEmail, setEsEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedOffice = useMemo(
    () => offices.find((office) => office.id === officeId) ?? null,
    [offices, officeId]
  );

  const serviceGroups = useMemo(
    () => servicesGroupedByState(serviceCatalog, selectedOffice?.state ?? null),
    [serviceCatalog, selectedOffice?.state]
  );

  const serviceOptions = useMemo(() => flattenServiceGroups(serviceGroups), [serviceGroups]);

  const counselorsForOffice = useMemo(
    () =>
      counselors.filter((c) => {
        const ids = c.office_ids?.length ? c.office_ids : [c.office_id];
        return ids.includes(officeId);
      }),
    [counselors, officeId]
  );

  if (!open) {
    return null;
  }

  function resetAndClose() {
    setName("");
    setEmail("");
    setOfficeId(offices[0]?.id ?? "");
    setServiceId("");
    setCounselorId("");
    setEsUserId(esUsers?.[0]?.id ?? "");
    setEsEmail("");
    setError(null);
    onClose();
  }

  function handleOfficeChange(nextOfficeId: string) {
    setOfficeId(nextOfficeId);
    setCounselorId("");
    const nextOffice = offices.find((office) => office.id === nextOfficeId);
    const nextOptions = flattenServiceGroups(
      servicesGroupedByState(serviceCatalog, nextOffice?.state ?? null)
    );
    setServiceId(nextOptions[0]?.id ?? "");
  }

  useEffect(() => {
    if (!open) return;
    if (serviceId && serviceOptions.some((option) => option.id === serviceId)) return;
    setServiceId(serviceOptions[0]?.id ?? "");
  }, [open, serviceId, serviceOptions]);

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
          ...(email.trim() ? { email: email.trim() } : {}),
          serviceId,
          officeId,
          counselorId,
          ...(esUsers
            ? allowEsEmail && esEmail.trim()
              ? { esEmail: esEmail.trim() }
              : { esUserId: esUserId || undefined }
            : {}),
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
          Add a client to your caseload. Email is optional — without it there is no client login,
          messaging, or client dashboard until an email is added later.
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
              Email <span className="font-normal text-brand-black/55">(optional)</span>
            </label>
            <input
              id="client-email"
              type="email"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              autoComplete="email"
              placeholder="Leave blank for no client login yet"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-black" htmlFor="office">
              Office
            </label>
            <select
              id="office"
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
              value={officeId}
              onChange={(ev) => handleOfficeChange(ev.target.value)}
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
            <label className="block text-sm font-medium text-brand-black" htmlFor="service">
              Service
            </label>
            <ServiceSelect
              id="service"
              groups={serviceGroups}
              value={serviceId}
              onChange={setServiceId}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
            />
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
                  {c.is_active === false ? " (inactive)" : ""}
                  {c.offices?.name ? ` · ${c.offices.name}` : ""}
                </option>
              ))}
            </select>
          </div>
          {esUsers && esUsers.length > 0 ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-brand-black" htmlFor="es-user">
                  Assign to employment specialist (optional)
                </label>
                <select
                  id="es-user"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
                  value={esUserId}
                  onChange={(ev) => {
                    setEsUserId(ev.target.value);
                    setEsEmail("");
                  }}
                >
                  <option value="">Unassigned</option>
                  {esUsers.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>
              {allowEsEmail ? (
                <div>
                  <label className="block text-sm font-medium text-brand-black" htmlFor="es-email">
                    Or assign by email
                  </label>
                  <input
                    id="es-email"
                    type="email"
                    placeholder="specialist@thejoshuatree.org"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
                    value={esEmail}
                    onChange={(ev) => {
                      setEsEmail(ev.target.value);
                      if (ev.target.value.trim()) {
                        setEsUserId("");
                      }
                    }}
                  />
                  <p className="mt-1 text-xs text-brand-black/60">
                    Use your own email to assign the client to yourself.
                  </p>
                </div>
              ) : null}
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
              disabled={submitting || serviceOptions.length === 0 || offices.length === 0}
              className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-gold/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving…" : email.trim() ? "Create client" : "Create client (no login)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
