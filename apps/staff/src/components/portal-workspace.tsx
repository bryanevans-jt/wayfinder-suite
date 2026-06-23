"use client";

import type { PortalBootstrap, ActivityLogRow } from "@/lib/portal-data";
import { formatPortalDateTime } from "@/lib/portal-datetime";
import {
  clientDisplayName,
  personDisplayName,
} from "@wayfinder/branding";
import {
  AddClientModal,
  type CounselorOption,
} from "@/app/dashboard/clients/add-client-modal";
import { AdminMessageAuditPanel } from "@/components/admin-message-audit-panel";
import { ClientDetailDrawer } from "@/components/client-detail-drawer";
import { ClientImportPanel } from "@/components/client-import-panel";
import { ClientListRow } from "@/components/client-list-row";
import { ErrorLogPanel } from "@/components/error-log-panel";
import { ClientProfileModal } from "@/components/client-profile-modal";
import { NaturalSupportModal } from "@/components/natural-support-modal";
import {
  PortalNav,
  isActivityLogsNav,
  isTeamCounselorsNav,
  isTeamEsNav,
  isTeamSupervisorsNav,
  type PortalNavState,
} from "@/components/portal-nav";
import { PortalSetupChecklist } from "@/components/portal-setup-checklist";
import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useMemo, useState } from "react";

type PortalMode = "super_admin" | "admin" | "supervisor";

type Props = {
  mode: PortalMode;
  title: string;
  subtitle: string;
};

type ConfigResponse = {
  bootstrap: PortalBootstrap;
  canEditLogs: boolean;
  canAssignAdmins: boolean;
  role: string;
};

export function PortalWorkspace({ mode, title, subtitle }: Props) {
  const [nav, setNav] = useState<PortalNavState>({ primary: "clients" });
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterEs, setFilterEs] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterOffice, setFilterOffice] = useState("");
  const [newOfficeName, setNewOfficeName] = useState("");
  const [newOfficeState, setNewOfficeState] = useState("GA");
  const [newOfficeCity, setNewOfficeCity] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [clientFilterOffice, setClientFilterOffice] = useState("");
  const [clientFilterEs, setClientFilterEs] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [newEsName, setNewEsName] = useState("");
  const [newEsEmail, setNewEsEmail] = useState("");
  const [newEsOfficeIds, setNewEsOfficeIds] = useState<string[]>([]);
  const [newCounselorName, setNewCounselorName] = useState("");
  const [newCounselorEmail, setNewCounselorEmail] = useState("");
  const [newCounselorOfficeIds, setNewCounselorOfficeIds] = useState<string[]>([]);
  const [newSupervisorName, setNewSupervisorName] = useState("");
  const [newSupervisorEmail, setNewSupervisorEmail] = useState("");
  const [newSupervisorOfficeIds, setNewSupervisorOfficeIds] = useState<string[]>([]);
  const [supportModalClient, setSupportModalClient] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [profileModalClient, setProfileModalClient] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [drawerClient, setDrawerClient] = useState<PortalBootstrap["clients"][number] | null>(
    null
  );

  const canManageOrg = mode !== "supervisor";
  const canManageClients = true;
  const [showArchivedClients, setShowArchivedClients] = useState(false);
  const canEditLogs = config?.canEditLogs ?? false;
  const canAssignAdmins = config?.canAssignAdmins ?? false;
  const b = config?.bootstrap;

  const reload = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/portal/config?tier=${mode}`, { cache: "no-store" });
    const data = (await res.json()) as ConfigResponse & { error?: string };
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setConfig(data);
  }, [mode]);

  const reloadLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterEs) params.set("es", filterEs);
    if (filterClient) params.set("client", filterClient);
    if (filterOffice) params.set("office", filterOffice);
    const res = await fetch(`/api/portal/logs?${params.toString()}`);
    const data = (await res.json()) as { logs?: ActivityLogRow[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setLogs(data.logs ?? []);
  }, [filterEs, filterClient, filterOffice]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (isActivityLogsNav(nav)) {
      void reloadLogs();
    }
  }, [nav, reloadLogs]);

  const officeName = useMemo(() => {
    const map = new Map((b?.offices ?? []).map((o) => [o.id, o.name]));
    return (id: string | null) => (id ? (map.get(id) ?? id) : "—");
  }, [b?.offices]);

  const esLabel = useMemo(() => {
    const map = new Map(Object.entries(b?.staffNameById ?? {}));
    return (id: string | null) => (id ? (map.get(id) ?? id) : "—");
  }, [b?.staffNameById]);

  const staffLabel = useMemo(() => {
    const map = new Map(Object.entries(b?.staffNameById ?? {}));
    return (id: string | null) => (id ? (map.get(id) ?? id) : "—");
  }, [b?.staffNameById]);

  const clientLabel = useMemo(() => {
    const map = new Map((b?.clients ?? []).map((c) => [c.id, clientDisplayName(c)]));
    return (id: string | null) => (id ? (map.get(id) ?? id) : "—");
  }, [b?.clients]);

  const counselorLabel = useMemo(() => {
    const map = new Map(
      (b?.counselors ?? []).map((c) => [
        c.id,
        personDisplayName({ full_name: c.full_name, id: c.id }),
      ])
    );
    return (id: string | null) => (id ? (map.get(id) ?? id) : "—");
  }, [b?.counselors]);

  const portalCounselors = useMemo((): CounselorOption[] => {
    if (!b) return [];
    const officeNameById = new Map(b.offices.map((o) => [o.id, o.name]));
    return b.counselors.map((c) => ({
      id: c.id,
      full_name: c.full_name,
      office_id: c.office_id ?? c.office_ids[0] ?? "",
      offices: c.office_id ? { name: officeNameById.get(c.office_id) ?? "" } : null,
    }));
  }, [b]);

  const filteredClients = useMemo(() => {
    if (!b) return [];
    const q = clientSearch.trim().toLowerCase();
    return b.clients.filter((c) => {
      if (mode === "supervisor" && !showArchivedClients && c.archived_at) return false;
      if (clientFilterOffice && c.office_id !== clientFilterOffice) return false;
      if (clientFilterEs && !c.es_user_ids.includes(clientFilterEs)) return false;
      if (!q) return true;
      const hay = [
        c.full_name,
        c.contact_email,
        c.service_name,
        c.stage_title,
        c.counselor_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [b, clientFilterOffice, clientFilterEs, clientSearch, mode, showArchivedClients]);

  useEffect(() => {
    setDrawerClient((current) => {
      if (!current || !b) return current;
      return b.clients.find((c) => c.id === current.id) ?? current;
    });
  }, [b]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
      if (isActivityLogsNav(nav)) await reloadLogs();
    } catch (e) {
      setError(friendlyClientError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-6 py-10">
      <header className="max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">{title}</p>
        <h1 className="mt-1 text-3xl font-semibold text-brand-black">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-brand-black/75">{subtitle}</p>
      </header>

      <PortalNav mode={mode} canManage={canManageOrg} nav={nav} onChange={setNav} />

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {!b ? (
        <p className="mt-6 text-sm text-brand-black/60">Loading…</p>
      ) : nav.primary === "offices" ? (
        <section className="mt-6 max-w-3xl space-y-6">
          {canManageOrg ? (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const res = await fetch("/api/portal/offices", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: newOfficeName,
                      state: newOfficeState,
                      city: newOfficeCity.trim() || undefined,
                    }),
                  });
                  const data = (await res.json()) as { error?: string };
                  if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                  setNewOfficeName("");
                  setNewOfficeCity("");
                });
              }}
            >
              <input
                value={newOfficeName}
                onChange={(e) => setNewOfficeName(e.target.value)}
                placeholder="Office name"
                className="min-w-[160px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                required
              />
              <select
                value={newOfficeState}
                onChange={(e) => setNewOfficeState(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                aria-label="State"
              >
                <option value="GA">GA</option>
                <option value="TN">TN</option>
              </select>
              <input
                value={newOfficeCity}
                onChange={(e) => setNewOfficeCity(e.target.value)}
                placeholder="City (optional)"
                className="min-w-[140px] rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Add office
              </button>
            </form>
          ) : null}
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
            {b.offices.map((o) => (
              <OfficeListItem
                key={o.id}
                office={o}
                canManage={canManageOrg}
                busy={busy}
                onSave={(payload) =>
                  run(async () => {
                    const res = await fetch("/api/portal/offices", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: o.id, ...payload }),
                    });
                    const data = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                  })
                }
                onDelete={() =>
                  run(async () => {
                    if (!confirm(`Delete office “${o.name}”?`)) return;
                    const res = await fetch(`/api/portal/offices?id=${o.id}`, {
                      method: "DELETE",
                    });
                    const data = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                  })
                }
              />
            ))}
          </ul>
        </section>
      ) : nav.primary === "clients" ? (
        <section className="mt-6 max-w-6xl space-y-4">
          {canManageOrg ? (
            <PortalSetupChecklist bootstrap={b} canManage={canManageOrg} onNavigate={setNav} />
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-brand-black/70">
              {canManageOrg
                ? "Search clients, add new ones, or import from CSV. Click a client to update their details."
                : "Clients in your assigned offices or supervised ES caseloads. Click a client to assign ES, change service, or update stage."}
            </p>
            {canManageClients ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setAddClientOpen(true)}
                className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Add client
              </button>
            ) : null}
          </div>
          {canManageOrg ? (
            <ClientImportPanel disabled={busy} onComplete={() => void reload()} />
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Search name or email…"
              className="min-w-[180px] rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <select
              value={clientFilterOffice}
              onChange={(e) => setClientFilterOffice(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">All offices</option>
              {b.offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select
              value={clientFilterEs}
              onChange={(e) => setClientFilterEs(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">All employment specialists</option>
              {b.esUsers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.display_name}
                </option>
              ))}
            </select>
            {mode === "supervisor" ? (
              <label className="inline-flex items-center gap-2 text-sm text-brand-black/80">
                <input
                  type="checkbox"
                  checked={showArchivedClients}
                  onChange={(e) => setShowArchivedClients(e.target.checked)}
                  className="size-4 rounded border-neutral-300 text-brand-green focus:ring-brand-green"
                />
                View archived
              </label>
            ) : null}
          </div>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-brand-black/70">
                <tr>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Office</th>
                  <th className="px-3 py-2">Employment specialist</th>
                  <th className="px-3 py-2">Current stage</th>
                  <th className="px-3 py-2"> </th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-brand-black/60">
                      {b.clients.length === 0 && canManageOrg
                        ? "No clients yet. Add one above or use CSV import for bulk onboarding."
                        : "No clients match your filters."}
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((c) => (
                    <ClientListRow
                      key={c.id}
                      client={c}
                      busy={busy}
                      officeName={officeName}
                      esLabel={esLabel}
                      onManage={() => setDrawerClient(c)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {canManageClients ? (
            <AddClientModal
              open={addClientOpen}
              onClose={() => setAddClientOpen(false)}
              services={b.services}
              offices={b.offices.map((o) => ({ id: o.id, name: o.name }))}
              counselors={portalCounselors}
              createEndpoint="/api/portal/clients"
              esUsers={b.esUsers.map((e) => ({
                id: e.id,
                label: e.display_name,
              }))}
              allowEsEmail={mode === "supervisor"}
              onCreated={() => void run(async () => {})}
            />
          ) : null}
        </section>
      ) : isTeamEsNav(nav) ? (
        <section className="mt-6 max-w-4xl space-y-6">
          {canManageOrg ? (
            <form
              className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const res = await fetch("/api/portal/es-users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      full_name: newEsName,
                      email: newEsEmail,
                      office_ids: newEsOfficeIds,
                    }),
                  });
                  const data = (await res.json()) as { error?: string };
                  if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                  setNewEsName("");
                  setNewEsEmail("");
                  setNewEsOfficeIds([]);
                });
              }}
            >
              <h2 className="text-lg font-semibold text-brand-black">Add Employment Specialist</h2>
              <p className="text-sm text-brand-black/70">
                We&apos;ll email them a login link if they&apos;re new to Wayfinder, then grant
                employment specialist access.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={newEsName}
                  onChange={(e) => setNewEsName(e.target.value)}
                  placeholder="Full name"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  required
                />
                <input
                  type="email"
                  value={newEsEmail}
                  onChange={(e) => setNewEsEmail(e.target.value)}
                  placeholder="Email"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <OfficeCheckboxGroup
                label="Offices"
                offices={b.offices}
                selected={newEsOfficeIds}
                disabled={busy}
                onChange={setNewEsOfficeIds}
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Add ES
              </button>
            </form>
          ) : (
            <p className="text-sm text-brand-black/70">
              Employment Specialists you supervise or share an office with. Use Activity logs to review
              their client work.
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-brand-black/70">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Offices</th>
                  <th className="px-3 py-2">Clients</th>
                  <th className="px-3 py-2">Status</th>
                  {canManageOrg ? <th className="px-3 py-2">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {b.esStaff.length === 0 ? (
                  <tr>
                    <td colSpan={canManageOrg ? 5 : 4} className="px-3 py-8 text-center text-brand-black/60">
                      No Employment Specialists in your scope.
                    </td>
                  </tr>
                ) : canManageOrg ? (
                  b.esStaff.map((es) => (
                    <EsStaffListItem
                      key={es.id}
                      staff={es}
                      offices={b.offices}
                      busy={busy}
                      officeName={officeName}
                      onSave={(payload) =>
                        run(async () => {
                          const res = await fetch("/api/portal/es-users", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ user_id: es.id, ...payload }),
                          });
                          const data = (await res.json()) as { error?: string };
                          if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                        })
                      }
                      onDelete={() =>
                        run(async () => {
                          const msg =
                            es.client_count > 0
                              ? `${es.display_name} still has ${es.client_count} assigned client(s). Reassign them first.`
                              : `Remove ${es.display_name} as an Employment Specialist? Their login account will remain but they will be deactivated.`;
                          if (es.client_count > 0) {
                            throw new Error(msg);
                          }
                          if (!confirm(msg)) return;
                          const res = await fetch(`/api/portal/es-users?user_id=${es.id}`, {
                            method: "DELETE",
                          });
                          const data = (await res.json()) as { error?: string };
                          if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                        })
                      }
                    />
                  ))
                ) : (
                  b.esStaff.map((es) => {
                    const officeLabels =
                      es.office_ids.map((id) => officeName(id)).join(", ") || "—";
                    return (
                      <tr key={es.id} className="border-t border-neutral-100">
                        <td className="px-3 py-3">
                          <p className="font-medium text-brand-black">{es.display_name}</p>
                          {es.email && es.display_name !== es.email ? (
                            <p className="text-xs text-brand-black/60">{es.email}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">{officeLabels}</td>
                        <td className="px-3 py-3">{es.client_count}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              es.is_active
                                ? "bg-brand-green/10 text-brand-green"
                                : "bg-neutral-200 text-brand-black/60"
                            }`}
                          >
                            {es.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : isTeamCounselorsNav(nav) && canManageOrg ? (
        <section className="mt-6 max-w-4xl space-y-6">
          <p className="text-sm text-brand-black/70">
            Counselors are external partners with <strong>view-only</strong> access to their
            assigned clients and activity timelines. They cannot edit records or use staff tools.
          </p>
          <form
            className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const res = await fetch("/api/portal/counselors", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    full_name: newCounselorName,
                    email: newCounselorEmail,
                    office_ids: newCounselorOfficeIds,
                  }),
                });
                const data = (await res.json()) as { error?: string };
                if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                setNewCounselorName("");
                setNewCounselorEmail("");
                setNewCounselorOfficeIds([]);
              });
            }}
          >
            <h2 className="text-lg font-semibold text-brand-black">Add counselor</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={newCounselorName}
                onChange={(e) => setNewCounselorName(e.target.value)}
                placeholder="Full name"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                required
              />
              <input
                type="email"
                value={newCounselorEmail}
                onChange={(e) => setNewCounselorEmail(e.target.value)}
                placeholder="Email for view-only login"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <OfficeCheckboxGroup
              label="Offices"
              offices={b.offices}
              selected={newCounselorOfficeIds}
              disabled={busy}
              onChange={setNewCounselorOfficeIds}
            />
            <button
              type="submit"
              disabled={busy || newCounselorOfficeIds.length === 0}
              className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Add counselor
            </button>
          </form>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-brand-black/70">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Offices</th>
                  <th className="px-3 py-2">Clients</th>
                  <th className="px-3 py-2">Access</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {b.counselorStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-brand-black/60">
                      No counselors yet.
                    </td>
                  </tr>
                ) : (
                  b.counselorStaff.map((c) => (
                    <CounselorStaffListItem
                      key={c.id}
                      counselor={c}
                      offices={b.offices}
                      busy={busy}
                      officeName={officeName}
                      onSave={(payload) =>
                        run(async () => {
                          const res = await fetch("/api/portal/counselors", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: c.id, ...payload }),
                          });
                          const data = (await res.json()) as { error?: string };
                          if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                        })
                      }
                      onDelete={() =>
                        run(async () => {
                          if (c.client_count > 0) {
                            throw new Error(
                              `${c.full_name} still has ${c.client_count} assigned client(s). Reassign them first.`
                            );
                          }
                          if (
                            !confirm(
                              `Remove counselor “${c.full_name}”? Their login will be deactivated if one exists.`
                            )
                          ) {
                            return;
                          }
                          const res = await fetch(`/api/portal/counselors?id=${c.id}`, {
                            method: "DELETE",
                          });
                          const data = (await res.json()) as { error?: string };
                          if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                        })
                      }
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : isTeamSupervisorsNav(nav) && canManageOrg ? (
        <section className="mt-6 max-w-4xl space-y-6">
          <p className="text-sm text-brand-black/70">
            Supervisors oversee employment specialists — not counselors. Link supervisors to ES staff
            under Settings → Advanced connections, or when editing a team member.
          </p>
          <form
            className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const res = await fetch("/api/portal/supervisors", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    full_name: newSupervisorName,
                    email: newSupervisorEmail,
                    office_ids: newSupervisorOfficeIds,
                  }),
                });
                const data = (await res.json()) as { error?: string };
                if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                setNewSupervisorName("");
                setNewSupervisorEmail("");
                setNewSupervisorOfficeIds([]);
              });
            }}
          >
            <h2 className="text-lg font-semibold text-brand-black">Add supervisor</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={newSupervisorName}
                onChange={(e) => setNewSupervisorName(e.target.value)}
                placeholder="Full name"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                required
              />
              <input
                type="email"
                value={newSupervisorEmail}
                onChange={(e) => setNewSupervisorEmail(e.target.value)}
                placeholder="Email"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <OfficeCheckboxGroup
              label="Offices (optional scope for activity logs)"
              offices={b.offices}
              selected={newSupervisorOfficeIds}
              disabled={busy}
              onChange={setNewSupervisorOfficeIds}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Add supervisor
            </button>
          </form>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-brand-black/70">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Offices</th>
                  <th className="px-3 py-2">ES staff</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {b.supervisorStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-brand-black/60">
                      No supervisors yet.
                    </td>
                  </tr>
                ) : (
                  b.supervisorStaff.map((s) => (
                    <SupervisorStaffListItem
                      key={s.id}
                      staff={s}
                      offices={b.offices}
                      busy={busy}
                      officeName={officeName}
                      onSave={(payload) =>
                        run(async () => {
                          const res = await fetch("/api/portal/supervisors", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ user_id: s.id, ...payload }),
                          });
                          const data = (await res.json()) as { error?: string };
                          if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                        })
                      }
                      onDelete={() =>
                        run(async () => {
                          if (s.es_count > 0) {
                            throw new Error(
                              `${s.display_name} still supervises ${s.es_count} ES staff member(s). Remove those links first.`
                            );
                          }
                          if (
                            !confirm(
                              `Remove ${s.display_name} as a supervisor? Their login will remain but they will be deactivated.`
                            )
                          ) {
                            return;
                          }
                          const res = await fetch(`/api/portal/supervisors?user_id=${s.id}`, {
                            method: "DELETE",
                          });
                          const data = (await res.json()) as { error?: string };
                          if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                        })
                      }
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (nav.primary === "settings" && nav.settings === "advanced") ||
        nav.primary === "connections" ? (
        <section className="mt-6 max-w-5xl space-y-6">
          {canManageOrg ? (
            <div>
              <h2 className="text-lg font-semibold text-brand-black">Advanced connections</h2>
              <p className="mt-1 text-sm text-brand-black/70">
                Most day-to-day assignments happen when you add or edit clients and team members.
                Use this section only when you need to adjust links in bulk.
              </p>
            </div>
          ) : (
            <p className="text-sm text-brand-black/70">
              Staff and client connections in your scope. Contact an admin to make changes.
            </p>
          )}
          <div className="grid gap-8 lg:grid-cols-2">
          {canManageOrg ? (
            <>
              <AssignmentCard
                title="Counselor office access"
                description="Which offices each counselor can view (read-only access to assigned clients)."
                busy={busy}
                onAdd={(counselorId, officeId) =>
                  run(async () => {
                    const res = await fetch("/api/portal/assignments", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        type: "counselor_office",
                        counselor_id: counselorId,
                        office_id: officeId,
                      }),
                    });
                    const data = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                  })
                }
                links={b.counselorOfficeLinks}
                leftOptions={b.counselors.map((c) => ({
                  id: c.id,
                  label: personDisplayName({ full_name: c.full_name, id: c.id }),
                }))}
                rightOptions={b.offices.map((o) => ({ id: o.id, label: o.name }))}
                onRemove={(id) =>
                  run(async () => {
                    const res = await fetch(
                      `/api/portal/assignments?type=counselor_office&id=${id}`,
                      { method: "DELETE" }
                    );
                    const data = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                  })
                }
                labelLink={(l) => {
                  return `${counselorLabel(l.counselor_id)} · ${officeName(l.office_id)}`;
                }}
              />
              <AssignmentCard
                title="ES office coverage"
                description="Offices each employment specialist can work from."
                busy={busy}
                onAdd={(userId, officeId) =>
                  run(async () => {
                    const res = await fetch("/api/portal/assignments", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        type: "staff_office",
                        user_id: userId,
                        office_id: officeId,
                      }),
                    });
                    const data = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                  })
                }
                links={b.staffOfficeLinks}
                leftOptions={b.esUsers.map((e) => ({
                  id: e.id,
                  label: e.display_name,
                }))}
                rightOptions={b.offices.map((o) => ({ id: o.id, label: o.name }))}
                onRemove={(id) =>
                  run(async () => {
                    const res = await fetch(`/api/portal/assignments?type=staff_office&id=${id}`, {
                      method: "DELETE",
                    });
                    const data = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                  })
                }
                labelLink={(l) => {
                  return `${staffLabel(l.user_id)} · ${officeName(l.office_id)}`;
                }}
              />
              <AssignmentCard
                title="Supervisor to ES link"
                description="Which employment specialists each supervisor oversees."
                busy={busy}
                onAdd={(supervisorId, esId) =>
                  run(async () => {
                    const res = await fetch("/api/portal/assignments", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        type: "supervisor_es",
                        supervisor_user_id: supervisorId,
                        es_user_id: esId,
                      }),
                    });
                    const data = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                  })
                }
                links={b.supervisorEsLinks}
                leftOptions={b.supervisors.map((s) => ({
                  id: s.id,
                  label: s.display_name,
                }))}
                rightOptions={b.esUsers.map((e) => ({
                  id: e.id,
                  label: e.display_name,
                }))}
                onRemove={(id) =>
                  run(async () => {
                    const res = await fetch(`/api/portal/assignments?type=supervisor_es&id=${id}`, {
                      method: "DELETE",
                    });
                    const data = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                  })
                }
                labelLink={(l) => {
                  return `${staffLabel(l.supervisor_user_id)} → ${staffLabel(l.es_user_id)}`;
                }}
              />
              <AssignmentCard
                title="Client caseload"
                description="Which employment specialist owns each client's caseload."
                busy={busy}
                onAdd={(esId, clientId) =>
                  run(async () => {
                    const res = await fetch("/api/portal/assignments", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        type: "es_client",
                        es_user_id: esId,
                        client_id: clientId,
                      }),
                    });
                    const data = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                  })
                }
                links={b.esClientLinks}
                leftOptions={b.esUsers.map((e) => ({
                  id: e.id,
                  label: e.display_name,
                }))}
                rightOptions={b.clients.map((c) => ({
                  id: c.id,
                  label: clientDisplayName(c),
                }))}
                onRemove={(id) =>
                  run(async () => {
                    const res = await fetch(`/api/portal/assignments?type=es_client&id=${id}`, {
                      method: "DELETE",
                    });
                    const data = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                  })
                }
                labelLink={(l) => {
                  return `${staffLabel(l.es_user_id)} → ${clientLabel(l.client_id)}`;
                }}
              />
            </>
          ) : (
            <div className="max-w-3xl space-y-6 text-sm">
              <p className="text-brand-black/70">
                Assignments in your scope. Contact an admin to change links.
              </p>
              <ReadOnlyLinkList
                title="Supervisor ↔ ES"
                links={b.supervisorEsLinks.map((l) => ({
                  id: l.id,
                  label: `${staffLabel(l.supervisor_user_id)} → ${staffLabel(l.es_user_id)}`,
                }))}
                empty="No ES staff linked to you yet."
              />
              <ReadOnlyLinkList
                title="Client ↔ ES"
                links={b.esClientLinks.map((l) => ({
                  id: l.id,
                  label: `${staffLabel(l.es_user_id)} → ${clientLabel(l.client_id)}`,
                }))}
                empty="No client caseloads in your scope."
              />
              <ReadOnlyLinkList
                title="ES ↔ office"
                links={b.staffOfficeLinks.map((l) => ({
                  id: l.id,
                  label: `${staffLabel(l.user_id)} · ${officeName(l.office_id)}`,
                }))}
                empty="No ES office links in your scope."
              />
            </div>
          )}
          </div>
        </section>
      ) : isActivityLogsNav(nav) ? (
        <section className="mt-6 max-w-6xl space-y-4">
          <div className="flex flex-wrap gap-3">
            <select
              value={filterOffice}
              onChange={(e) => setFilterOffice(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">All offices</option>
              {b.offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select
              value={filterEs}
              onChange={(e) => setFilterEs(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">All ES</option>
              {b.esUsers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.display_name}
                </option>
              ))}
            </select>
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">All clients</option>
              {b.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {clientDisplayName(c)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={() => void reloadLogs()}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
            >
              Apply filters
            </button>
            <a
              href={`/api/portal/logs?format=csv&es=${filterEs}&client=${filterClient}&office=${filterOffice}`}
              className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white"
            >
              Export CSV
            </a>
          </div>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-brand-black/70">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Office</th>
                  <th className="px-3 py-2">Summary</th>
                  {canEditLogs ? <th className="px-3 py-2">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={canEditLogs ? 6 : 5} className="px-3 py-8 text-center text-brand-black/60">
                      No activity for these filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((row) => (
                    <tr key={`${row.kind}-${row.id}`} className="border-t border-neutral-100">
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatPortalDateTime(row.created_at)}
                      </td>
                      <td className="px-3 py-2 capitalize">{row.kind}</td>
                      <td className="px-3 py-2">
                        {row.client_name ??
                          clientDisplayName({
                            contact_email: row.client_email,
                            id: row.client_id,
                          })}
                      </td>
                      <td className="px-3 py-2">{officeName(row.office_id)}</td>
                      <td className="px-3 py-2">{row.summary}</td>
                      {canEditLogs && row.kind === "contact" ? (
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="text-red-700 hover:underline"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                if (!confirm("Delete this contact log?")) return;
                                const res = await fetch(`/api/portal/logs?id=${row.id}`, {
                                  method: "DELETE",
                                });
                                const data = (await res.json()) as { error?: string };
                                if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                              })
                            }
                          >
                            Delete
                          </button>
                        </td>
                      ) : canEditLogs ? (
                        <td className="px-3 py-2 text-brand-black/40">—</td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!canEditLogs ? (
            <p className="text-xs text-brand-black/60">
              Admin tier can view and export logs but cannot edit or delete them.
            </p>
          ) : null}
        </section>
      ) : nav.primary === "reports" && nav.reports === "messages" && canManageOrg ? (
        <AdminMessageAuditPanel
          clients={b.clients}
          isSuperAdmin={config?.role === "super_admin"}
        />
      ) : nav.primary === "settings" && nav.settings === "errors" && mode === "super_admin" ? (
        <ErrorLogPanel />
      ) : nav.primary === "settings" && (nav.settings ?? "users") === "users" && canManageOrg ? (
        <section className="mt-6 max-w-3xl space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-brand-black">Administrators</h2>
            <p className="mt-1 text-sm text-brand-black/70">
              Admin and super admin accounts. Protected accounts cannot be edited or deactivated.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-brand-black/70">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {b.admins.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-brand-black/60">
                      No administrators found.
                    </td>
                  </tr>
                ) : (
                  b.admins.map((a) => (
                    <AdminUserListItem
                      key={a.id}
                      admin={a}
                      busy={busy}
                      canEdit={
                        !a.is_protected && (canAssignAdmins || a.role === "admin")
                      }
                      onSave={(payload) =>
                        run(async () => {
                          const res = await fetch("/api/portal/users", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ user_id: a.id, ...payload }),
                          });
                          const data = (await res.json()) as { error?: string };
                          if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                        })
                      }
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {canAssignAdmins ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const res = await fetch("/api/portal/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: adminEmail, role: "admin" }),
                  });
                  const data = (await res.json()) as { error?: string };
                  if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
                  setAdminEmail("");
                });
              }}
            >
              <h2 className="text-lg font-semibold text-brand-black">Assign admin by email</h2>
              <p className="text-sm text-brand-black/70">
                Invites the user if they do not exist yet, then sets their role to admin.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="colleague@thejoshuatree.org"
                  className="min-w-[240px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  required
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Assign admin
                </button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-brand-black/60">
              Only super admin can invite new administrators. You can edit non-protected admin
              accounts above.
            </p>
          )}
        </section>
      ) : null}

      {b && drawerClient ? (
        <ClientDetailDrawer
          open={drawerClient !== null}
          client={drawerClient}
          offices={b.offices}
          esUsers={b.esUsers}
          counselors={portalCounselors}
          serviceCatalog={b.serviceCatalog}
          serviceMilestones={b.serviceMilestones}
          busy={busy}
          allowDelete={canManageClients}
          allowEsEmail={mode === "supervisor"}
          caseworkHref={mode === "supervisor" ? `/dashboard/clients/${drawerClient.id}` : null}
          onClose={() => setDrawerClient(null)}
          onSave={(payload) =>
            run(async () => {
              const res = await fetch("/api/portal/clients", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: drawerClient.id, ...payload }),
              });
              const data = (await res.json()) as { error?: string };
              if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
            })
          }
          onDelete={async () => {
            const label = clientDisplayName(drawerClient);
            if (
              !confirm(
                `Delete client “${label}”? This removes their client record but not their login account.`
              )
            ) {
              return;
            }
            await run(async () => {
              const res = await fetch(`/api/portal/clients?id=${drawerClient.id}`, {
                method: "DELETE",
              });
              const data = (await res.json()) as { error?: string };
              if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
              setDrawerClient(null);
            });
          }}
          onOpenProfile={() => {
            setProfileModalClient({
              id: drawerClient.id,
              label: clientDisplayName(drawerClient),
            });
          }}
          onOpenSupport={() => {
            setSupportModalClient({
              id: drawerClient.id,
              label: clientDisplayName(drawerClient),
            });
          }}
        />
      ) : null}

      <NaturalSupportModal
        open={supportModalClient !== null}
        clientId={supportModalClient?.id ?? null}
        clientLabel={supportModalClient?.label ?? null}
        onClose={() => setSupportModalClient(null)}
      />
      <ClientProfileModal
        open={profileModalClient !== null}
        clientId={profileModalClient?.id ?? ""}
        clientLabel={profileModalClient?.label ?? ""}
        onClose={() => setProfileModalClient(null)}
      />
    </main>
  );
}

type LinkRow = { id: string; [key: string]: string };

type ClientRow = PortalBootstrap["clients"][number];

type EsStaffRow = PortalBootstrap["esStaff"][number];
type CounselorStaffRow = PortalBootstrap["counselorStaff"][number];
type SupervisorStaffRow = PortalBootstrap["supervisorStaff"][number];
type AdminUserRow = PortalBootstrap["admins"][number];

function ReadOnlyLinkList({
  title,
  links,
  empty,
}: {
  title: string;
  links: { id: string; label: string }[];
  empty: string;
}) {
  return (
    <div>
      <h3 className="font-semibold text-brand-black">{title}</h3>
      {links.length === 0 ? (
        <p className="mt-2 text-brand-black/60">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {links.map((l) => (
            <li key={l.id} className="px-4 py-2.5 text-brand-black/80">
              {l.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminUserListItem({
  admin,
  busy,
  canEdit,
  onSave,
}: {
  admin: AdminUserRow;
  busy: boolean;
  canEdit: boolean;
  onSave: (payload: { full_name: string; is_active: boolean }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(admin.full_name ?? admin.display_name);
  const [isActive, setIsActive] = useState(admin.is_active);

  useEffect(() => {
    setName(admin.full_name ?? admin.display_name);
    setIsActive(admin.is_active);
  }, [admin]);

  const roleLabel = admin.role === "super_admin" ? "Super admin" : "Admin";

  if (editing && canEdit) {
    return (
      <tr className="border-t border-neutral-100 bg-neutral-50/80">
        <td className="px-3 py-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full min-w-[140px] rounded border border-neutral-300 px-2 py-1 text-sm"
            disabled={busy}
          />
          {admin.email ? (
            <p className="mt-1 text-xs text-brand-black/60">{admin.email}</p>
          ) : null}
        </td>
        <td className="px-3 py-3">{roleLabel}</td>
        <td className="px-3 py-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              disabled={busy}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
        </td>
        <td className="whitespace-nowrap px-3 py-3">
          <button
            type="button"
            disabled={busy || !name.trim()}
            className="mr-3 font-medium text-brand-green hover:underline disabled:opacity-60"
            onClick={() =>
              void onSave({ full_name: name.trim(), is_active: isActive }).then(() =>
                setEditing(false)
              )
            }
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-brand-black/60 hover:underline disabled:opacity-60"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-neutral-100">
      <td className="px-3 py-3">
        <p className="font-medium text-brand-black">{admin.display_name}</p>
        {admin.email && admin.display_name !== admin.email ? (
          <p className="text-xs text-brand-black/60">{admin.email}</p>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <span className="text-brand-black/80">{roleLabel}</span>
        {admin.is_protected ? (
          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            Protected
          </span>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            admin.is_active
              ? "bg-brand-green/10 text-brand-green"
              : "bg-neutral-200 text-brand-black/60"
          }`}
        >
          {admin.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        {canEdit ? (
          <button
            type="button"
            disabled={busy}
            className="font-medium text-brand-green hover:underline disabled:opacity-60"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        ) : (
          <span className="text-brand-black/40">—</span>
        )}
      </td>
    </tr>
  );
}

function OfficeCheckboxGroup({
  label,
  offices,
  selected,
  onChange,
  disabled,
}: {
  label: string;
  offices: PortalBootstrap["offices"];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  if (offices.length === 0) {
    return <p className="text-sm text-brand-black/60">No offices configured yet.</p>;
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-brand-black">{label}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {offices.map((office) => (
          <label key={office.id} className="flex items-center gap-2 text-sm text-brand-black">
            <input
              type="checkbox"
              checked={selected.includes(office.id)}
              disabled={disabled}
              onChange={() => {
                onChange(
                  selected.includes(office.id)
                    ? selected.filter((id) => id !== office.id)
                    : [...selected, office.id]
                );
              }}
            />
            {office.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function EsStaffListItem({
  staff,
  offices,
  busy,
  officeName,
  onSave,
  onDelete,
}: {
  staff: EsStaffRow;
  offices: PortalBootstrap["offices"];
  busy: boolean;
  officeName: (id: string | null) => string;
  onSave: (payload: {
    full_name: string;
    is_active: boolean;
    office_ids: string[];
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(staff.full_name ?? staff.display_name);
  const [isActive, setIsActive] = useState(staff.is_active);
  const [officeIds, setOfficeIds] = useState(staff.office_ids);

  useEffect(() => {
    setName(staff.full_name ?? staff.display_name);
    setIsActive(staff.is_active);
    setOfficeIds(staff.office_ids);
  }, [staff]);

  const officeLabels =
    staff.office_ids.length > 0
      ? staff.office_ids.map((id) => officeName(id)).join(", ")
      : "—";

  if (editing) {
    return (
      <tr className="border-t border-neutral-100 bg-neutral-50/80">
        <td className="px-3 py-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-1 w-full min-w-[140px] rounded border border-neutral-300 px-2 py-1 text-sm"
            placeholder="Full name"
            disabled={busy}
          />
          <p className="text-xs text-brand-black/60">{staff.email || "—"}</p>
        </td>
        <td className="px-3 py-3">
          <OfficeCheckboxGroup
            label=""
            offices={offices}
            selected={officeIds}
            disabled={busy}
            onChange={setOfficeIds}
          />
        </td>
        <td className="px-3 py-3 text-brand-black/70">{staff.client_count}</td>
        <td className="px-3 py-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              disabled={busy}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
        </td>
        <td className="whitespace-nowrap px-3 py-3">
          <button
            type="button"
            disabled={busy || !name.trim()}
            className="mr-3 font-medium text-brand-green hover:underline disabled:opacity-60"
            onClick={() =>
              void onSave({
                full_name: name.trim(),
                is_active: isActive,
                office_ids: officeIds,
              }).then(() => setEditing(false))
            }
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-brand-black/60 hover:underline disabled:opacity-60"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-neutral-100">
      <td className="px-3 py-3">
        <p className="font-medium text-brand-black">{staff.display_name}</p>
        {staff.email && staff.display_name !== staff.email ? (
          <p className="text-xs text-brand-black/60">{staff.email}</p>
        ) : null}
      </td>
      <td className="px-3 py-3">{officeLabels}</td>
      <td className="px-3 py-3">{staff.client_count}</td>
      <td className="px-3 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            staff.is_active
              ? "bg-brand-green/10 text-brand-green"
              : "bg-neutral-200 text-brand-black/60"
          }`}
        >
          {staff.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <button
          type="button"
          disabled={busy}
          className="mr-3 font-medium text-brand-green hover:underline disabled:opacity-60"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <button
          type="button"
          disabled={busy}
          className="text-red-700 hover:underline disabled:opacity-60"
          onClick={() => void onDelete()}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

function CounselorStaffListItem({
  counselor,
  offices,
  busy,
  officeName,
  onSave,
  onDelete,
}: {
  counselor: CounselorStaffRow;
  offices: PortalBootstrap["offices"];
  busy: boolean;
  officeName: (id: string | null) => string;
  onSave: (payload: {
    full_name: string;
    email?: string;
    is_active?: boolean;
    office_ids: string[];
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(counselor.full_name);
  const [email, setEmail] = useState(counselor.email ?? "");
  const [isActive, setIsActive] = useState(counselor.is_active);
  const [officeIds, setOfficeIds] = useState(
    counselor.office_ids.length > 0
      ? counselor.office_ids
      : counselor.office_id
        ? [counselor.office_id]
        : []
  );

  useEffect(() => {
    setName(counselor.full_name);
    setEmail(counselor.email ?? "");
    setIsActive(counselor.is_active);
    setOfficeIds(
      counselor.office_ids.length > 0
        ? counselor.office_ids
        : counselor.office_id
          ? [counselor.office_id]
          : []
    );
  }, [counselor]);

  const officeLabels =
    (counselor.office_ids.length > 0
      ? counselor.office_ids
      : counselor.office_id
        ? [counselor.office_id]
        : []
    )
      .map((id) => officeName(id))
      .join(", ") || "—";

  if (editing) {
    return (
      <tr className="border-t border-neutral-100 bg-neutral-50/80">
        <td className="px-3 py-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-1 w-full min-w-[140px] rounded border border-neutral-300 px-2 py-1 text-sm"
            placeholder="Full name"
            disabled={busy}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full min-w-[140px] rounded border border-neutral-300 px-2 py-1 text-sm"
            placeholder="Login email"
            disabled={busy || counselor.has_login}
          />
        </td>
        <td className="px-3 py-3">
          <OfficeCheckboxGroup
            label=""
            offices={offices}
            selected={officeIds}
            disabled={busy}
            onChange={setOfficeIds}
          />
        </td>
        <td className="px-3 py-3 text-brand-black/70">{counselor.client_count}</td>
        <td className="px-3 py-3">
          {counselor.has_login ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                disabled={busy}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active login
            </label>
          ) : (
            <span className="text-xs text-brand-black/60">Invite via email above</span>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-3">
          <button
            type="button"
            disabled={busy || !name.trim() || officeIds.length === 0}
            className="mr-3 font-medium text-brand-green hover:underline disabled:opacity-60"
            onClick={() =>
              void onSave({
                full_name: name.trim(),
                ...(email.trim() && !counselor.has_login ? { email: email.trim() } : {}),
                ...(counselor.has_login ? { is_active: isActive } : {}),
                office_ids: officeIds,
              }).then(() => setEditing(false))
            }
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-brand-black/60 hover:underline disabled:opacity-60"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-neutral-100">
      <td className="px-3 py-3">
        <p className="font-medium text-brand-black">{counselor.full_name}</p>
        {counselor.email ? (
          <p className="text-xs text-brand-black/60">{counselor.email}</p>
        ) : (
          <p className="text-xs text-amber-700">No login linked</p>
        )}
      </td>
      <td className="px-3 py-3">{officeLabels}</td>
      <td className="px-3 py-3">{counselor.client_count}</td>
      <td className="px-3 py-3">
        {!counselor.has_login ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            No login
          </span>
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              counselor.is_active
                ? "bg-brand-green/10 text-brand-green"
                : "bg-neutral-200 text-brand-black/60"
            }`}
          >
            {counselor.is_active ? "View-only · Active" : "Inactive"}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <button
          type="button"
          disabled={busy}
          className="mr-3 font-medium text-brand-green hover:underline disabled:opacity-60"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <button
          type="button"
          disabled={busy}
          className="text-red-700 hover:underline disabled:opacity-60"
          onClick={() => void onDelete()}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

function SupervisorStaffListItem({
  staff,
  offices,
  busy,
  officeName,
  onSave,
  onDelete,
}: {
  staff: SupervisorStaffRow;
  offices: PortalBootstrap["offices"];
  busy: boolean;
  officeName: (id: string | null) => string;
  onSave: (payload: {
    full_name: string;
    is_active: boolean;
    office_ids: string[];
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(staff.full_name ?? staff.display_name);
  const [isActive, setIsActive] = useState(staff.is_active);
  const [officeIds, setOfficeIds] = useState(staff.office_ids);

  useEffect(() => {
    setName(staff.full_name ?? staff.display_name);
    setIsActive(staff.is_active);
    setOfficeIds(staff.office_ids);
  }, [staff]);

  const officeLabels =
    staff.office_ids.length > 0
      ? staff.office_ids.map((id) => officeName(id)).join(", ")
      : "—";

  if (editing) {
    return (
      <tr className="border-t border-neutral-100 bg-neutral-50/80">
        <td className="px-3 py-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-1 w-full min-w-[140px] rounded border border-neutral-300 px-2 py-1 text-sm"
            disabled={busy}
          />
          <p className="text-xs text-brand-black/60">{staff.email}</p>
        </td>
        <td className="px-3 py-3">
          <OfficeCheckboxGroup
            label=""
            offices={offices}
            selected={officeIds}
            disabled={busy}
            onChange={setOfficeIds}
          />
        </td>
        <td className="px-3 py-3 text-brand-black/70">{staff.es_count}</td>
        <td className="px-3 py-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              disabled={busy}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
        </td>
        <td className="whitespace-nowrap px-3 py-3">
          <button
            type="button"
            disabled={busy || !name.trim()}
            className="mr-3 font-medium text-brand-green hover:underline disabled:opacity-60"
            onClick={() =>
              void onSave({
                full_name: name.trim(),
                is_active: isActive,
                office_ids: officeIds,
              }).then(() => setEditing(false))
            }
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-brand-black/60 hover:underline disabled:opacity-60"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-neutral-100">
      <td className="px-3 py-3">
        <p className="font-medium text-brand-black">{staff.display_name}</p>
        {staff.email && staff.display_name !== staff.email ? (
          <p className="text-xs text-brand-black/60">{staff.email}</p>
        ) : null}
      </td>
      <td className="px-3 py-3">{officeLabels}</td>
      <td className="px-3 py-3">{staff.es_count}</td>
      <td className="px-3 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            staff.is_active
              ? "bg-brand-green/10 text-brand-green"
              : "bg-neutral-200 text-brand-black/60"
          }`}
        >
          {staff.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <button
          type="button"
          disabled={busy}
          className="mr-3 font-medium text-brand-green hover:underline disabled:opacity-60"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <button
          type="button"
          disabled={busy}
          className="text-red-700 hover:underline disabled:opacity-60"
          onClick={() => void onDelete()}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

type OfficeRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

function OfficeListItem({
  office,
  canManage,
  busy,
  onSave,
  onDelete,
}: {
  office: OfficeRow;
  canManage: boolean;
  busy: boolean;
  onSave: (payload: { name: string; city: string; state: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(office.name);
  const [city, setCity] = useState(office.city ?? "");
  const [state, setState] = useState(office.state ?? "");

  useEffect(() => {
    setName(office.name);
    setCity(office.city ?? "");
    setState(office.state ?? "");
  }, [office]);

  if (editing && canManage) {
    return (
      <li className="space-y-2 px-4 py-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Office name"
            className="min-w-[140px] flex-1 rounded-lg border border-neutral-300 px-3 py-1.5"
            disabled={busy}
          />
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5"
            aria-label="State"
            disabled={busy}
          >
            <option value="">Select state</option>
            <option value="GA">GA</option>
            <option value="TN">TN</option>
          </select>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="min-w-[120px] rounded-lg border border-neutral-300 px-3 py-1.5"
            disabled={busy}
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy || !name.trim()}
            className="font-medium text-brand-green hover:underline disabled:opacity-60"
            onClick={() =>
              void onSave({ name: name.trim(), city: city.trim(), state }).then(() =>
                setEditing(false)
              )
            }
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-brand-black/60 hover:underline disabled:opacity-60"
            onClick={() => {
              setName(office.name);
              setCity(office.city ?? "");
              setState(office.state ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
      <div>
        <p className="font-medium text-brand-black">{office.name}</p>
        {office.city || office.state ? (
          <p className="text-xs text-brand-black/60">
            {[office.city, office.state].filter(Boolean).join(", ")}
          </p>
        ) : null}
      </div>
      {canManage ? (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy}
            className="font-medium text-brand-green hover:underline disabled:opacity-60"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-red-700 hover:underline disabled:opacity-60"
            onClick={() => void onDelete()}
          >
            Delete
          </button>
        </div>
      ) : null}
    </li>
  );
}

function AssignmentCard<T extends LinkRow>({
  title,
  description,
  busy,
  leftOptions,
  rightOptions,
  links,
  onAdd,
  onRemove,
  labelLink,
}: {
  title: string;
  description: string;
  busy: boolean;
  leftOptions: { id: string; label: string }[];
  rightOptions: { id: string; label: string }[];
  links: T[];
  onAdd: (leftId: string, rightId: string) => void;
  onRemove: (id: string) => void;
  labelLink: (link: T) => string;
}) {
  const [left, setLeft] = useState(leftOptions[0]?.id ?? "");
  const [right, setRight] = useState(rightOptions[0]?.id ?? "");

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="font-semibold text-brand-black">{title}</h3>
      <p className="mt-1 text-xs text-brand-black/65">{description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={left}
          onChange={(e) => setLeft(e.target.value)}
          className="min-w-[140px] flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
        >
          {leftOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={right}
          onChange={(e) => setRight(e.target.value)}
          className="min-w-[140px] flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
        >
          {rightOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !left || !right}
          onClick={() => onAdd(left, right)}
          className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          Add
        </button>
      </div>
      <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
        {links.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-2 rounded bg-neutral-50 px-2 py-1">
            <span className="truncate">{labelLink(l)}</span>
            <button
              type="button"
              disabled={busy}
              className="shrink-0 text-red-700 hover:underline"
              onClick={() => onRemove(l.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
