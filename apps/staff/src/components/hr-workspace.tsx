"use client";

import type { HrAssignmentLink, HrClientRow } from "@/lib/hr-registry-data";
import {
  ClientListPaginationControls,
  useClientListPagination,
} from "@/components/client-list-pagination";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = {
  clients: HrClientRow[];
  offices: { id: string; name: string; state: string | null }[];
  esUsers: { id: string; name: string }[];
  states: string[];
  supervisorEsLinks: HrAssignmentLink[];
  esClientLinks: HrAssignmentLink[];
  staffOfficeLinks: HrAssignmentLink[];
  initial: {
    officeId: string;
    esUserId: string;
    clientId: string;
    state: string;
    from: string;
    to: string;
    tab: string;
  };
};

export function HrWorkspace({
  clients,
  offices,
  esUsers,
  states,
  supervisorEsLinks,
  esClientLinks,
  staffOfficeLinks,
  initial,
}: Props) {
  const router = useRouter();
  const [officeId, setOfficeId] = useState(initial.officeId);
  const [esUserId, setEsUserId] = useState(initial.esUserId);
  const [clientId, setClientId] = useState(initial.clientId);
  const [state, setState] = useState(initial.state);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [tab, setTab] = useState(initial.tab || "clients");

  const clientOptions = useMemo(
    () =>
      [...clients]
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  const {
    pageSize: clientPageSize,
    setPageSize: setClientPageSize,
    page: clientPage,
    setPage: setClientPage,
    totalPages: clientTotalPages,
    pageItems: pagedClients,
    totalCount: clientTotalCount,
  } = useClientListPagination(clients);

  function applyFilters() {
    const params = new URLSearchParams();
    if (officeId) params.set("office", officeId);
    if (esUserId) params.set("es", esUserId);
    if (clientId) params.set("client", clientId);
    if (state) params.set("state", state);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (tab) params.set("tab", tab);
    router.push(`/dashboard/hr?${params.toString()}`);
  }

  const exportQs = useMemo(() => {
    const params = new URLSearchParams();
    if (officeId) params.set("office", officeId);
    if (esUserId) params.set("es", esUserId);
    if (clientId) params.set("client", clientId);
    if (state) params.set("state", state);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [officeId, esUserId, clientId, state, from, to]);

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-2">
        {(
          [
            ["clients", "Clients"],
            ["timesheets", "Timesheets"],
            ["activity", "Activity logs"],
            ["connections", "Connections"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              const params = new URLSearchParams(window.location.search);
              params.set("tab", id);
              router.push(`/dashboard/hr?${params.toString()}`);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === id
                ? "bg-brand-green text-white"
                : "border border-neutral-300 text-brand-black hover:bg-neutral-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {(tab === "clients" || tab === "activity") && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <label className="text-sm font-medium">
            Office
            <select
              value={officeId}
              onChange={(e) => setOfficeId(e.target.value)}
              className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">All offices</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Employment Specialist
            <select
              value={esUserId}
              onChange={(e) => setEsUserId(e.target.value)}
              className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">All Employment Specialists</option>
              {esUsers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Client
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 block max-w-[220px] rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">All clients</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            State
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </div>
      )}

      {tab === "clients" ? (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/hr/clients-export?format=csv&${exportQs}`}
              className="rounded-lg border border-brand-gold bg-brand-gold px-3 py-2 text-sm font-semibold text-white"
            >
              Export CSV
            </a>
          </div>
          <ClientListPaginationControls
            pageSize={clientPageSize}
            onPageSizeChange={setClientPageSize}
            page={clientPage}
            totalPages={clientTotalPages}
            totalCount={clientTotalCount}
            onPageChange={setClientPage}
          />
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-brand-black/70">
                <tr>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Office</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Employment Specialist</th>
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2">Current stage</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-brand-black/60">
                      No clients match these filters.
                    </td>
                  </tr>
                ) : (
                  pagedClients.map((c) => (
                    <tr key={c.id} className="border-t border-neutral-100">
                      <td className="px-3 py-3">
                        <p className="font-medium">{c.name}</p>
                        {c.email ? <p className="text-xs text-brand-black/60">{c.email}</p> : null}
                      </td>
                      <td className="px-3 py-3">{c.officeName ?? "—"}</td>
                      <td className="px-3 py-3">{c.state ?? "—"}</td>
                      <td className="px-3 py-3">{c.esNames}</td>
                      <td className="px-3 py-3">{c.serviceName ?? "—"}</td>
                      <td className="px-3 py-3">{c.stageTitle ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <ClientListPaginationControls
            pageSize={clientPageSize}
            onPageSizeChange={setClientPageSize}
            page={clientPage}
            totalPages={clientTotalPages}
            totalCount={clientTotalCount}
            onPageChange={setClientPage}
          />
        </section>
      ) : null}

      {tab === "timesheets" ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-semibold text-brand-black">Timesheets</h2>
          <p className="mt-1 text-sm text-brand-black/70">
            View all Employment Specialist timesheets (approved and unapproved) and export CSV/PDF
            from the Timesheet page.
          </p>
          <Link
            href="/dashboard/timesheet"
            className="mt-4 inline-flex rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white"
          >
            Open timesheets
          </Link>
        </section>
      ) : null}

      {tab === "activity" ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-semibold text-brand-black">Activity logs</h2>
          <p className="mt-1 text-sm text-brand-black/70">
            Export activity for the filtered caseload as CSV.
          </p>
          <a
            href={`/api/hr/activity-export?${exportQs}`}
            className="mt-4 inline-flex rounded-lg border border-brand-gold bg-brand-gold px-4 py-2 text-sm font-semibold text-white"
          >
            Download activity CSV
          </a>
        </section>
      ) : null}

      {tab === "connections" ? (
        <section className="grid gap-6 lg:grid-cols-3">
          <ReadOnlyList
            title="Supervisor ↔ Employment Specialist"
            links={supervisorEsLinks}
            empty="No supervisor links."
          />
          <ReadOnlyList
            title="Client ↔ Employment Specialist"
            links={esClientLinks}
            empty="No caseload links."
          />
          <ReadOnlyList
            title="Employment Specialist ↔ office"
            links={staffOfficeLinks}
            empty="No office links."
          />
        </section>
      ) : null}
    </div>
  );
}

function ReadOnlyList({
  title,
  links,
  empty,
}: {
  title: string;
  links: HrAssignmentLink[];
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="font-semibold text-brand-black">{title}</h3>
      <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto text-sm">
        {links.length === 0 ? (
          <li className="text-brand-black/55">{empty}</li>
        ) : (
          links.map((l) => (
            <li key={l.id} className="rounded bg-neutral-50 px-2 py-1">
              {l.label}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
