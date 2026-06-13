"use client";

import type { CounselorOption } from "@/app/dashboard/clients/add-client-modal";
import type { PortalBootstrap } from "@/lib/portal-data";
import { clientDisplayName, personDisplayName, servicesForClientEdit } from "@wayfinder/branding";
import { useEffect, useMemo, useState } from "react";

type ClientRow = PortalBootstrap["clients"][number];

type SavePayload = {
  name: string;
  contact_email: string;
  office_id: string;
  counselor_id: string;
  es_user_id: string | null;
  current_service_id: string;
  current_stage_id: string;
};

type Props = {
  open: boolean;
  client: ClientRow | null;
  offices: PortalBootstrap["offices"];
  esUsers: PortalBootstrap["esUsers"];
  counselors: CounselorOption[];
  serviceCatalog: PortalBootstrap["serviceCatalog"];
  serviceMilestones: PortalBootstrap["serviceMilestones"];
  busy: boolean;
  onClose: () => void;
  onSave: (payload: SavePayload) => Promise<void>;
  onDelete: () => Promise<void>;
  onOpenProfile: () => void;
  onOpenSupport: () => void;
};

export function ClientDetailDrawer({
  open,
  client,
  offices,
  esUsers,
  counselors,
  serviceCatalog,
  serviceMilestones,
  busy,
  onClose,
  onSave,
  onDelete,
  onOpenProfile,
  onOpenSupport,
}: Props) {
  const serviceOptions = useMemo(
    () =>
      client
        ? servicesForClientEdit(serviceCatalog, client.current_service_id)
        : [],
    [serviceCatalog, client]
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [counselorId, setCounselorId] = useState("");
  const [esUserId, setEsUserId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [stageId, setStageId] = useState("");

  useEffect(() => {
    if (!client) return;
    setName(client.full_name ?? "");
    setEmail(client.contact_email ?? "");
    setOfficeId(client.office_id ?? offices[0]?.id ?? "");
    setCounselorId(client.counselor_id ?? "");
    setEsUserId(client.es_user_ids[0] ?? "");
    const nextServiceId = client.current_service_id ?? serviceOptions[0]?.id ?? "";
    setServiceId(nextServiceId);
    setStageId(client.current_stage_id ?? "");
  }, [client, offices, serviceOptions]);

  const stagesForService = useMemo(
    () =>
      serviceMilestones
        .filter((m) => m.service_id === serviceId)
        .sort((a, b) => a.order_index - b.order_index),
    [serviceMilestones, serviceId]
  );

  useEffect(() => {
    if (!open) return;
    if (stagesForService.some((m) => m.id === stageId)) return;
    setStageId(stagesForService[0]?.id ?? "");
  }, [open, stagesForService, stageId]);

  const counselorsForOffice = useMemo(
    () => counselors.filter((c) => c.office_id === officeId),
    [counselors, officeId]
  );

  if (!open || !client) {
    return null;
  }

  const displayName = clientDisplayName(client);

  function handleServiceChange(nextServiceId: string) {
    setServiceId(nextServiceId);
    const nextStages = serviceMilestones
      .filter((m) => m.service_id === nextServiceId)
      .sort((a, b) => a.order_index - b.order_index);
    setStageId(nextStages[0]?.id ?? "");
  }

  const canSave =
    !busy &&
    name.trim().length > 0 &&
    officeId.length > 0 &&
    counselorId.length > 0 &&
    serviceId.length > 0 &&
    stageId.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button
        type="button"
        aria-label="Close panel"
        className="flex-1"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-drawer-title"
        className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-neutral-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-neutral-100 bg-white px-5 py-4">
          <div>
            <h2 id="client-drawer-title" className="text-lg font-semibold text-brand-black">
              {displayName}
            </h2>
            <p className="text-sm text-brand-black/65">Update client details and assignments</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-brand-black/60 hover:bg-neutral-100"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block text-sm">
            <span className="font-medium text-brand-black">Full name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              disabled={busy}
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-brand-black">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              disabled={busy}
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-brand-black">Office</span>
            <select
              value={officeId}
              onChange={(e) => {
                setOfficeId(e.target.value);
                setCounselorId("");
              }}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              disabled={busy}
            >
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-brand-black">Employment specialist</span>
            <select
              value={esUserId}
              onChange={(e) => setEsUserId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              disabled={busy}
            >
              <option value="">Unassigned</option>
              {esUsers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.display_name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-brand-black">Counselor</span>
            <select
              value={counselorId}
              onChange={(e) => setCounselorId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              disabled={busy}
            >
              <option value="">Select counselor</option>
              {counselorsForOffice.map((c) => (
                <option key={c.id} value={c.id}>
                  {personDisplayName({ full_name: c.full_name, id: c.id })}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-brand-black">Service</span>
            <select
              value={serviceId}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              disabled={busy || serviceOptions.length === 0}
            >
              {serviceOptions.length === 0 ? (
                <option value="">No services</option>
              ) : (
                serviceOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-brand-black">Current stage</span>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              disabled={busy || stagesForService.length === 0}
            >
              {stagesForService.length === 0 ? (
                <option value="">No stages</option>
              ) : (
                stagesForService.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        <div className="mt-auto space-y-3 border-t border-neutral-100 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canSave}
              onClick={() =>
                void onSave({
                  name: name.trim(),
                  contact_email: email.trim(),
                  office_id: officeId,
                  counselor_id: counselorId,
                  es_user_id: esUserId || null,
                  current_service_id: serviceId,
                  current_stage_id: stageId,
                })
              }
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Save changes
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onOpenProfile}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-brand-black hover:bg-neutral-50 disabled:opacity-60"
            >
              Profile & goals
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onOpenSupport}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-brand-black hover:bg-neutral-50 disabled:opacity-60"
            >
              Natural support
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDelete().then(onClose)}
            className="text-sm text-red-700 hover:underline disabled:opacity-60"
          >
            Delete client record
          </button>
        </div>
      </div>
    </div>
  );
}
