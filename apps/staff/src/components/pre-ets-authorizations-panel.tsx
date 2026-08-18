"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

type Authorization = {
  id: string;
  auth_number: string | null;
  auth_type: string;
  service_code: string;
  service_label: string | null;
  service_month: string;
  pre_ets_schools: { name: string } | null;
  pre_ets_program_groups: {
    group_name: string;
    instructor_name: string | null;
    class_time: string | null;
  } | null;
};

type RosterRow = {
  id: string;
  participantId: string | null;
  fullName: string | null;
  unitsApproved: number | null;
};

type AuthTab = "all" | "group" | "individual" | "pending";

function schoolName(auth: Authorization): string {
  return auth.pre_ets_schools?.name ?? "—";
}

export function PreEtsAuthorizationsPanel() {
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [month, setMonth] = useState("");
  const [tab, setTab] = useState<AuthTab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (tab !== "all") params.set("authType", tab);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/pre-ets/authorizations${qs}`);
    const data = (await res.json()) as { authorizations?: Authorization[] };
    if (res.ok) setAuthorizations(data.authorizations ?? []);
  }, [month, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleRoster(authId: string) {
    if (expandedId === authId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(authId);
    const res = await fetch(`/api/pre-ets/authorizations/${authId}/roster`);
    const data = (await res.json()) as { roster?: RosterRow[] };
    if (res.ok) setRoster(data.roster ?? []);
  }

  const tabs: { id: AuthTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "group", label: "Group" },
    { id: "individual", label: "Individual" },
    { id: "pending", label: "Pending" },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-black">Authorizations &amp; rosters</h2>
          <p className="mt-1 text-sm text-brand-black/65">
            Group and individual authorizations from committed worksheets. Print blank rosters for
            sign-in collection.
          </p>
        </div>
        <label className="text-sm">
          <span className="font-medium">Filter month</span>
          <input
            type="month"
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "bg-brand-green/10 text-brand-green"
                : "text-brand-black/70 hover:bg-neutral-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">Auth #</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">School / Group</th>
              <th className="px-3 py-2">Service</th>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {authorizations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-brand-black/55">
                  No authorizations in this view. Commit a district worksheet import first.
                </td>
              </tr>
            ) : (
              authorizations.map((a) => (
                <Fragment key={a.id}>
                  <tr className="border-t border-neutral-100">
                    <td className="px-3 py-2 font-mono text-xs">{a.auth_number ?? "pending"}</td>
                    <td className="px-3 py-2 capitalize">{a.auth_type}</td>
                    <td className="px-3 py-2">
                      {schoolName(a)}
                      {a.pre_ets_program_groups?.group_name
                        ? ` · ${a.pre_ets_program_groups.group_name}`
                        : ""}
                    </td>
                    <td className="px-3 py-2">
                      {a.service_code}
                      {a.service_label ? ` (${a.service_label})` : ""}
                    </td>
                    <td className="px-3 py-2">{a.service_month?.slice(0, 7)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-xs text-brand-green hover:underline"
                          onClick={() => void toggleRoster(a.id)}
                        >
                          {expandedId === a.id ? "Hide roster" : "View roster"}
                        </button>
                        <a
                          href={`/api/pre-ets/authorizations/${a.id}/roster-pdf`}
                          className="text-xs text-brand-green hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Print PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                  {expandedId === a.id ? (
                    <tr className="border-t border-neutral-50 bg-neutral-50/50">
                      <td colSpan={6} className="px-3 py-3">
                        <ul className="space-y-1 text-xs text-brand-black/75">
                          {roster.length === 0 ? (
                            <li>No roster students on file.</li>
                          ) : (
                            roster.map((row) => (
                              <li key={row.id}>
                                {row.fullName} · PID {row.participantId ?? "—"} ·{" "}
                                {row.unitsApproved ?? 0} units approved
                              </li>
                            ))
                          )}
                        </ul>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
