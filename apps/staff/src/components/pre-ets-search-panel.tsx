"use client";

import { useState } from "react";

type SearchResult = {
  kind: string;
  id: string;
  [key: string]: unknown;
};

export function PreEtsSearchPanel() {
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [studentDetail, setStudentDetail] = useState<Record<string, unknown> | null>(null);

  async function search() {
    setStudentDetail(null);
    if (month) {
      const res = await fetch(`/api/pre-ets/search?type=month&month=${encodeURIComponent(month)}`);
      const data = (await res.json()) as { results?: SearchResult[] };
      setResults(data.results ?? []);
      return;
    }
    if (!query.trim()) return;
    const res = await fetch(`/api/pre-ets/search?q=${encodeURIComponent(query.trim())}`);
    const data = (await res.json()) as { results?: SearchResult[] };
    setResults(data.results ?? []);
  }

  async function openStudent(id: string) {
    const res = await fetch(`/api/pre-ets/students/${id}`);
    const data = await res.json();
    if (res.ok) setStudentDetail(data as Record<string, unknown>);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Search</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Find students, schools, authorization numbers, or browse by month.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="min-w-[200px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Student name, PID, school, or auth #"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void search()}
        />
        <input
          type="month"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <button
          type="button"
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white"
          onClick={() => void search()}
        >
          Search
        </button>
      </div>

      <ul className="space-y-2">
        {results.map((r) => (
          <li key={`${r.kind}-${r.id}`}>
            <button
              type="button"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm hover:bg-neutral-50"
              onClick={() => {
                if (r.kind === "student") void openStudent(r.id);
              }}
            >
              <span className="mr-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs uppercase">
                {r.kind}
              </span>
              {r.kind === "student"
                ? `${r.full_name as string} (${r.participant_id as string})`
                : r.kind === "school"
                  ? (r.name as string)
                  : r.kind === "authorization" || r.kind === "month_auth"
                    ? `Auth ${r.auth_number as string} · ${r.service_code as string}`
                    : JSON.stringify(r)}
            </button>
          </li>
        ))}
      </ul>

      {studentDetail ? (
        <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4 text-sm">
          <p className="font-semibold">
            {(studentDetail.student as { full_name: string })?.full_name}
          </p>
          <p className="text-brand-black/65">
            PID {(studentDetail.student as { participant_id: string })?.participant_id} · YTD units:{" "}
            {studentDetail.ytdUnits as number}
          </p>
          <ul className="mt-2 list-inside list-disc text-brand-black/70">
            {((studentDetail.authorizations as { pre_ets_authorizations: { auth_number: string } }[]) ??
              []
            ).map((entry, i) => (
              <li key={i}>Auth {entry.pre_ets_authorizations?.auth_number ?? "—"}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
