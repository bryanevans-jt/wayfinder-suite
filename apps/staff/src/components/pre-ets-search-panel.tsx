"use client";

import {
  isPreEtsServiceMonthFilterOmitted,
  parsePreEtsServiceMonthFilter,
} from "@/lib/pre-ets-service-month";
import { useState } from "react";

type SearchResult = {
  kind: string;
  id: string;
  [key: string]: unknown;
};

export function PreEtsSearchPanel() {
  const [query, setQuery] = useState("");
  /** Display value for the month control (may be incomplete while typing in Firefox). */
  const [monthInput, setMonthInput] = useState("");
  /** Only valid YYYY-MM (or empty) — drives month search fetches. */
  const [monthFilter, setMonthFilter] = useState("");
  const [monthError, setMonthError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [studentDetail, setStudentDetail] = useState<Record<string, unknown> | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  function onMonthInputChange(value: string) {
    setMonthInput(value);
    if (isPreEtsServiceMonthFilterOmitted(value)) {
      setMonthFilter("");
      setMonthError(null);
      return;
    }
    const parsed = parsePreEtsServiceMonthFilter(value);
    if (parsed.ok) {
      setMonthFilter(parsed.inputMonth);
      setMonthError(null);
      return;
    }
    // Incomplete / invalid typing: keep last applied filter; do not fetch with garbage.
    setMonthError(parsed.error);
  }

  async function search() {
    setStudentDetail(null);
    setSearchError(null);

    if (!isPreEtsServiceMonthFilterOmitted(monthInput)) {
      const parsed = parsePreEtsServiceMonthFilter(monthInput);
      if (!parsed.ok) {
        setMonthError(parsed.error);
        setSearchError(parsed.error);
        return;
      }
      const res = await fetch(
        `/api/pre-ets/search?type=month&month=${encodeURIComponent(parsed.inputMonth)}`
      );
      const data = (await res.json()) as { results?: SearchResult[]; error?: string };
      if (!res.ok) {
        setSearchError(data.error ?? "Search failed.");
        setResults([]);
        return;
      }
      setResults(data.results ?? []);
      return;
    }

    if (!query.trim()) return;
    const res = await fetch(`/api/pre-ets/search?q=${encodeURIComponent(query.trim())}`);
    const data = (await res.json()) as { results?: SearchResult[]; error?: string };
    if (!res.ok) {
      setSearchError(data.error ?? "Search failed.");
      setResults([]);
      return;
    }
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
          value={monthInput}
          onChange={(e) => onMonthInputChange(e.target.value)}
        />
        <button
          type="button"
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white"
          onClick={() => void search()}
        >
          Search
        </button>
      </div>
      {monthError ? <p className="text-sm text-red-700">{monthError}</p> : null}
      {searchError ? <p className="text-sm text-red-700">{searchError}</p> : null}
      {monthFilter && !monthError ? (
        <p className="text-xs text-brand-black/55">Browsing month {monthFilter}</p>
      ) : null}

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
            {(studentDetail.ytdUnits as number) >=
            ((studentDetail.ytdWarningThreshold as number) ?? 15) ? (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                At or above {studentDetail.ytdWarningThreshold as number}-unit warning
              </span>
            ) : null}
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
