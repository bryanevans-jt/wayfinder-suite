"use client";

import { useCallback, useEffect, useState } from "react";

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

export function PreEtsAuthorizationsPanel() {
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [month, setMonth] = useState("");

  const load = useCallback(async () => {
    const qs = month ? `?month=${encodeURIComponent(month)}` : "";
    const res = await fetch(`/api/pre-ets/authorizations${qs}`);
    const data = (await res.json()) as { authorizations?: Authorization[] };
    if (res.ok) setAuthorizations(data.authorizations ?? []);
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-black">Authorizations &amp; rosters</h2>
          <p className="mt-1 text-sm text-brand-black/65">
            Group and individual authorizations created from committed worksheet imports.
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

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">Auth #</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">School / Group</th>
              <th className="px-3 py-2">Service</th>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">Instructor</th>
            </tr>
          </thead>
          <tbody>
            {authorizations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-brand-black/55">
                  No authorizations yet. Commit a district worksheet import first.
                </td>
              </tr>
            ) : (
              authorizations.map((a) => (
                <tr key={a.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-mono text-xs">{a.auth_number ?? "pending"}</td>
                  <td className="px-3 py-2 capitalize">{a.auth_type}</td>
                  <td className="px-3 py-2">
                    {a.pre_ets_schools?.name ?? "—"}
                    {a.pre_ets_program_groups?.group_name
                      ? ` · ${a.pre_ets_program_groups.group_name}`
                      : ""}
                  </td>
                  <td className="px-3 py-2">
                    {a.service_code}
                    {a.service_label ? ` (${a.service_label})` : ""}
                  </td>
                  <td className="px-3 py-2">{a.service_month?.slice(0, 7)}</td>
                  <td className="px-3 py-2">{a.pre_ets_program_groups?.instructor_name ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
