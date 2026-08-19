"use client";

import type { PreEtsServiceCodeRow } from "@wayfinder/supabase/pre-ets-settings";
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

type PlanMode = "custom" | "recurring" | "monthly";

type SchedulePlan = {
  id: string;
  plan_type: string;
  recurrence_rule: Record<string, unknown> | null;
  excluded_months: string[] | null;
  planned_service_code: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function PreEtsSchedulePanel() {
  const [groups, setGroups] = useState<ProgramGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [planMode, setPlanMode] = useState<PlanMode>("custom");
  const [datesText, setDatesText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [weekday, setWeekday] = useState(2);
  const [dayOfMonth, setDayOfMonth] = useState(15);
  const [excludedMonths, setExcludedMonths] = useState("");
  const [plannedCode, setPlannedCode] = useState("");
  const [previewDates, setPreviewDates] = useState<string[]>([]);
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [serviceCodes, setServiceCodes] = useState<PreEtsServiceCodeRow[]>([]);

  const loadPlans = useCallback(async (programGroupId: string) => {
    if (!programGroupId) {
      setPlans([]);
      return;
    }
    const res = await fetch(
      `/api/pre-ets/schedule-plans?programGroupId=${encodeURIComponent(programGroupId)}`
    );
    const data = (await res.json()) as { plans?: SchedulePlan[] };
    if (res.ok) setPlans(data.plans ?? []);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/pre-ets/program-groups");
    const data = (await res.json()) as { groups?: ProgramGroup[] };
    if (res.ok) setGroups(data.groups ?? []);
  }, []);

  useEffect(() => {
    void load();
    void (async () => {
      const res = await fetch("/api/pre-ets/access");
      const data = (await res.json()) as { settings?: { service_codes?: PreEtsServiceCodeRow[] } };
      if (res.ok) setServiceCodes(data.settings?.service_codes ?? []);
    })();
  }, [load]);

  useEffect(() => {
    void loadPlans(selectedGroupId);
  }, [selectedGroupId, loadPlans]);

  const selected = groups.find((g) => g.id === selectedGroupId);
  const groupAuth = selected?.pre_ets_authorizations?.find((a) => a.auth_type === "group");
  const fallbackAuth = selected?.pre_ets_authorizations?.[0];
  const codeMismatch =
    plannedCode &&
    groupAuth?.auth_number &&
    selected?.service_code &&
    plannedCode !== selected.service_code;
  const unknownCatalogCode =
    plannedCode &&
    serviceCodes.length > 0 &&
    !serviceCodes.some((row) => row.code === plannedCode.trim());
  const selectedCatalog = serviceCodes.find((row) => row.code === plannedCode.trim());

  function buildPayload() {
    const excluded = excludedMonths
      .split(/[\n,]+/)
      .map((m) => m.trim().slice(0, 7))
      .filter(Boolean);

    if (planMode === "custom") {
      const sessionDates = datesText
        .split(/[\n,]+/)
        .map((d) => d.trim())
        .filter(Boolean);
      return {
        programGroupId: selectedGroupId,
        planType: sessionDates.length > 5 ? "intensive" : "custom",
        plannedServiceCode: plannedCode || null,
        sessionDates,
      };
    }

    if (planMode === "recurring") {
      return {
        programGroupId: selectedGroupId,
        planType: "recurring" as const,
        plannedServiceCode: plannedCode || null,
        startDate: startDate || null,
        endDate: endDate || null,
        excludedMonths: excluded,
        recurrenceRule: { weekday, intervalWeeks: 1 },
      };
    }

    return {
      programGroupId: selectedGroupId,
      planType: "monthly" as const,
      plannedServiceCode: plannedCode || null,
      startDate: startDate || null,
      endDate: endDate || null,
      excludedMonths: excluded,
      recurrenceRule: { dayOfMonth },
    };
  }

  async function createSchedule() {
    if (!selectedGroupId) return;
    setMessage(null);
    const res = await fetch("/api/pre-ets/schedule-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    const data = (await res.json()) as {
      sessionsCreated?: number;
      sessionDates?: string[];
      error?: string;
    };
    if (res.ok) {
      setPreviewDates(data.sessionDates ?? []);
      setMessage(`Created ${data.sessionsCreated ?? 0} scheduled session(s).`);
      setDatesText("");
      void loadPlans(selectedGroupId);
    } else {
      setMessage(data.error ?? "Schedule failed");
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Session planning</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Schedule instruction dates for a program group using custom dates, weekly recurring, or
          monthly patterns.
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
          <span className="font-medium">Plan type</span>
          <select
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={planMode}
            onChange={(e) => setPlanMode(e.target.value as PlanMode)}
          >
            <option value="custom">Custom dates</option>
            <option value="recurring">Weekly recurring</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>

        <label className="block">
          <span className="font-medium">Planned service code</span>
          {serviceCodes.length > 0 ? (
            <select
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={plannedCode}
              onChange={(e) => setPlannedCode(e.target.value)}
            >
              <option value="">Select code…</option>
              {serviceCodes.map((row) => (
                <option key={row.code} value={row.code}>
                  {row.code}
                  {row.service ? ` — ${row.service}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={plannedCode}
              onChange={(e) => setPlannedCode(e.target.value)}
              placeholder={selected?.service_code ?? "Code"}
            />
          )}
          {selectedCatalog?.description ? (
            <p className="mt-1 text-xs text-brand-black/55">{selectedCatalog.description}</p>
          ) : null}
          {codeMismatch ? (
            <p className="mt-1 text-xs text-amber-800">
              Planned code differs from worksheet service code ({selected?.service_code}).
            </p>
          ) : null}
          {unknownCatalogCode ? (
            <p className="mt-1 text-xs text-amber-800">
              Code is not in the Super Admin service code catalog.
            </p>
          ) : null}
        </label>

        {planMode === "custom" ? (
          <label className="block lg:col-span-2">
            <span className="font-medium">Session dates (one per line or comma-separated)</span>
            <textarea
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
              rows={4}
              placeholder="2025-09-12&#10;2025-09-19"
              value={datesText}
              onChange={(e) => setDatesText(e.target.value)}
            />
          </label>
        ) : (
          <>
            <label className="block">
              <span className="font-medium">Start date</span>
              <input
                type="date"
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="font-medium">End date</span>
              <input
                type="date"
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
            {planMode === "recurring" ? (
              <label className="block">
                <span className="font-medium">Weekday</span>
                <select
                  className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                  value={weekday}
                  onChange={(e) => setWeekday(Number(e.target.value))}
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block">
                <span className="font-medium">Day of month</span>
                <input
                  type="number"
                  min={1}
                  max={28}
                  className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                />
              </label>
            )}
            <label className="block lg:col-span-2">
              <span className="font-medium">Excluded months (YYYY-MM, comma-separated)</span>
              <input
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
                placeholder="2025-12, 2026-03"
                value={excludedMonths}
                onChange={(e) => setExcludedMonths(e.target.value)}
              />
            </label>
          </>
        )}

        <div className="lg:col-span-2">
          <button
            type="button"
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white"
            onClick={() => void createSchedule()}
          >
            Create sessions
          </button>
          {message ? <p className="mt-2 text-brand-black/70">{message}</p> : null}
          {previewDates.length > 0 ? (
            <p className="mt-2 text-xs text-brand-black/60">
              Dates: {previewDates.join(", ")}
            </p>
          ) : null}
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
            Authorized code: {selected.service_code ?? "—"} · Auth{" "}
            {groupAuth?.auth_number ?? fallbackAuth?.auth_number ?? "pending"} (
            {groupAuth?.auth_type ?? fallbackAuth?.auth_type ?? "—"})
          </p>
        </div>
      ) : null}

      {selectedGroupId ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-brand-black">Schedule plan history</h3>
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-brand-black/70">
                <tr>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Plan type</th>
                  <th className="px-3 py-2">Date range</th>
                  <th className="px-3 py-2">Service code</th>
                  <th className="px-3 py-2">Pattern</th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-brand-black/55">
                      No schedule plans for this group yet.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => (
                    <tr key={plan.id} className="border-t border-neutral-100">
                      <td className="px-3 py-2">
                        {new Date(plan.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 capitalize">{plan.plan_type}</td>
                      <td className="px-3 py-2">
                        {plan.start_date && plan.end_date
                          ? `${plan.start_date} → ${plan.end_date}`
                          : "Custom dates"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {plan.planned_service_code ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-brand-black/65">
                        {plan.plan_type === "recurring"
                          ? `Weekday ${String(plan.recurrence_rule?.weekday ?? "—")}`
                          : plan.plan_type === "monthly"
                            ? `Day ${String(plan.recurrence_rule?.dayOfMonth ?? "—")}`
                            : "—"}
                        {plan.excluded_months?.length
                          ? ` · Excludes ${plan.excluded_months.join(", ")}`
                          : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
