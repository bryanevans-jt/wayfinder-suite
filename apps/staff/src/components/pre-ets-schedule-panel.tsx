"use client";

import { useCallback, useEffect, useState } from "react";

type ProgramGroup = {
  id: string;
  group_name: string;
  frequency: string | null;
  instructor_name: string | null;
  class_time: string | null;
  service_code: string | null;
  service_month: string;
  pre_ets_schools: { name: string } | null;
  pre_ets_authorizations: { id: string; auth_number: string | null; auth_type: string }[] | null;
};

export function PreEtsSchedulePanel() {
  const [groups, setGroups] = useState<ProgramGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [datesText, setDatesText] = useState("");
  const [plannedCode, setPlannedCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/pre-ets/program-groups");
    const data = (await res.json()) as { groups?: ProgramGroup[] };
    if (res.ok) setGroups(data.groups ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createSchedule() {
    if (!selectedGroupId) return;
    const sessionDates = datesText
      .split(/[\n,]+/)
      .map((d) => d.trim())
      .filter(Boolean);

    const res = await fetch("/api/pre-ets/schedule-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        programGroupId: selectedGroupId,
        planType: sessionDates.length > 5 ? "intensive" : "custom",
        plannedServiceCode: plannedCode || null,
        sessionDates,
      }),
    });
    const data = (await res.json()) as { sessionsCreated?: number; error?: string };
    setMessage(
      res.ok
        ? `Created ${data.sessionsCreated ?? 0} scheduled session(s) with activity report drafts.`
        : data.error ?? "Schedule failed"
    );
    setDatesText("");
  }

  const selected = groups.find((g) => g.id === selectedGroupId);
  const groupAuth = selected?.pre_ets_authorizations?.find((a) => a.auth_type === "group");
  const codeMismatch =
    plannedCode &&
    groupAuth?.auth_number &&
    selected?.service_code &&
    plannedCode !== selected.service_code;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Session planning</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Schedule instruction dates for a program group. Each date creates a session and an empty
          Lesson Activity Report draft.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-neutral-200 bg-white p-4 text-sm lg:grid-cols-2">
        <label className="block">
          <span className="font-medium">Program group</span>
          <select
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={selectedGroupId}
            onChange={(e) => {
              setSelectedGroupId(e.target.value);
              const g = groups.find((x) => x.id === e.target.value);
              setPlannedCode(g?.service_code ?? "");
            }}
          >
            <option value="">Select group…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.pre_ets_schools?.name} · {g.group_name} ({g.service_month?.slice(0, 7)})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-medium">Planned service code</span>
          <input
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={plannedCode}
            onChange={(e) => setPlannedCode(e.target.value)}
            placeholder={selected?.service_code ?? "Code"}
          />
          {codeMismatch ? (
            <p className="mt-1 text-xs text-amber-800">
              Planned code differs from worksheet service code ({selected?.service_code}).
            </p>
          ) : null}
        </label>

        <label className="block lg:col-span-2">
          <span className="font-medium">Session dates (one per line or comma-separated)</span>
          <textarea
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
            rows={4}
            placeholder="2025-09-12&#10;2025-09-19&#10;2025-09-26"
            value={datesText}
            onChange={(e) => setDatesText(e.target.value)}
          />
        </label>

        <div className="lg:col-span-2">
          <button
            type="button"
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white"
            onClick={() => void createSchedule()}
          >
            Create sessions
          </button>
          {message ? <p className="mt-2 text-brand-black/70">{message}</p> : null}
        </div>
      </div>

      {selected ? (
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm text-brand-black/70">
          <p>
            <strong>{selected.pre_ets_schools?.name}</strong> · {selected.group_name}
          </p>
          <p>
            {selected.frequency ?? "—"} · {selected.instructor_name ?? "—"} · Class time{" "}
            {selected.class_time ?? "—"}
          </p>
          <p>
            Authorized code: {selected.service_code ?? "—"} · Group auth{" "}
            {groupAuth?.auth_number ?? "pending"}
          </p>
        </div>
      ) : null}
    </section>
  );
}
