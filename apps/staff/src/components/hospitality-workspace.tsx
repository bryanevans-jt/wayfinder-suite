"use client";

import type { HrAssignmentLink, HrClientRow } from "@/lib/hr-registry-data";
import {
  ClientListPaginationControls,
  useClientListPagination,
} from "@/components/client-list-pagination";
import Link from "next/link";
import { useMemo, useState } from "react";

type EmployerRow = {
  id: string;
  name: string;
  status: string;
  city: string | null;
  state: string | null;
};

type Props = {
  clients: HrClientRow[];
  employers: EmployerRow[];
  supervisorEsLinks: HrAssignmentLink[];
  esClientLinks: HrAssignmentLink[];
  staffOfficeLinks: HrAssignmentLink[];
  counselorOfficeLinks: HrAssignmentLink[];
};

export function HospitalityWorkspace({
  clients,
  employers,
  supervisorEsLinks,
  esClientLinks,
  staffOfficeLinks,
  counselorOfficeLinks,
}: Props) {
  const [tab, setTab] = useState<"logs" | "network" | "connections">("logs");
  const [clientQuery, setClientQuery] = useState("");

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const haystack = [
        c.name,
        c.email,
        c.officeName,
        c.esNames,
        c.serviceName,
        c.stageTitle,
        c.state,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [clients, clientQuery]);

  const {
    pageSize: clientPageSize,
    setPageSize: setClientPageSize,
    page: clientPage,
    setPage: setClientPage,
    totalPages: clientTotalPages,
    pageItems: pagedClients,
    totalCount: clientTotalCount,
  } = useClientListPagination(filteredClients);

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-2">
        {(
          [
            ["logs", "Client Logs"],
            ["network", "Community Network"],
            ["connections", "Connections"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
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

      {tab === "logs" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="hospitality-client-search">
              Search clients
            </label>
            <input
              id="hospitality-client-search"
              type="search"
              value={clientQuery}
              onChange={(e) => {
                setClientQuery(e.target.value);
                setClientPage(1);
              }}
              placeholder="Search by name, email, office, ES, service…"
              className="min-w-[16rem] flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
            />
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
                  <th className="px-3 py-2">Employment Specialist</th>
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2">Current stage</th>
                  <th className="px-3 py-2">Job start</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-brand-black/60">
                      {clients.length === 0
                        ? "No clients yet."
                        : "No clients match your search."}
                    </td>
                  </tr>
                ) : (
                  pagedClients.map((c) => (
                    <tr key={c.id} className="border-t border-neutral-100">
                      <td className="px-3 py-3 font-medium">
                        <Link
                          href={`/dashboard/clients/${c.id}`}
                          className="text-brand-green hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{c.officeName ?? "—"}</td>
                      <td className="px-3 py-3">{c.esNames}</td>
                      <td className="px-3 py-3">{c.serviceName ?? "—"}</td>
                      <td className="px-3 py-3">{c.stageTitle ?? "—"}</td>
                      <td className="px-3 py-3">{c.jobStartDate ?? "—"}</td>
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
        </div>
      ) : null}

      {tab === "network" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-brand-black/70">
              Active and pending Community Network members.
            </p>
            <Link
              href="/dashboard/hospitality/partner-check-ins"
              className="text-sm font-semibold text-brand-green hover:underline"
            >
              Monthly Partner Check-ins →
            </Link>
            <Link
              href="/dashboard/community-partners"
              className="text-sm font-semibold text-brand-green hover:underline"
            >
              Open full Community Partners map →
            </Link>
          </div>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-brand-black/70">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {employers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-brand-black/60">
                      No network members yet.
                    </td>
                  </tr>
                ) : (
                  employers.map((e) => (
                    <tr key={e.id} className="border-t border-neutral-100">
                      <td className="px-3 py-3 font-medium">{e.name}</td>
                      <td className="px-3 py-3">
                        {[e.city, e.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-3 py-3 capitalize">{e.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "connections" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <ReadOnlyList
            title="Supervisor ↔ Employment Specialist"
            links={supervisorEsLinks}
            empty="No links."
          />
          <ReadOnlyList
            title="Client ↔ Employment Specialist"
            links={esClientLinks}
            empty="No links."
          />
          <ReadOnlyList
            title="Employment Specialist ↔ Office"
            links={staffOfficeLinks}
            empty="No links."
          />
          <ReadOnlyList
            title="Counselor ↔ Office"
            links={counselorOfficeLinks}
            empty="No counselor office assignments."
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
