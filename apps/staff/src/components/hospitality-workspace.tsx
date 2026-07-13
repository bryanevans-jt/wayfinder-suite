"use client";

import type { HrAssignmentLink, HrClientRow } from "@/lib/hr-registry-data";
import Link from "next/link";
import { useState } from "react";

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
};

export function HospitalityWorkspace({
  clients,
  employers,
  supervisorEsLinks,
  esClientLinks,
  staffOfficeLinks,
}: Props) {
  const [tab, setTab] = useState<"logs" | "network" | "connections">("logs");

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-2">
        {(
          [
            ["logs", "Client logs"],
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
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-neutral-100">
                  <td className="px-3 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3">{c.officeName ?? "—"}</td>
                  <td className="px-3 py-3">{c.esNames}</td>
                  <td className="px-3 py-3">{c.serviceName ?? "—"}</td>
                  <td className="px-3 py-3">{c.stageTitle ?? "—"}</td>
                  <td className="px-3 py-3">{c.jobStartDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "network" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-brand-black/70">
              Active and pending Community Network members.
            </p>
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
        <section className="grid gap-6 lg:grid-cols-3">
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
            title="Employment Specialist ↔ office"
            links={staffOfficeLinks}
            empty="No links."
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
