"use client";

import { useState } from "react";
import { BillableHoursKraCompliancePanel } from "@/components/billable-hours-kra-compliance-panel";
import { BillableHoursPayrollMonthlyPanel } from "@/components/billable-hours-payroll-monthly-panel";

type Tab = "payroll" | "kra";

type Props = {
  initialMonthKey: string;
  canCloseKraMonth: boolean;
};

/**
 * One team-member oversight surface with tabs for payroll hours and KRA expectations.
 * Shared month picker lives in each panel so values stay in sync via parent month state.
 */
export function BillableHoursMonthlyOversight({
  initialMonthKey,
  canCloseKraMonth,
}: Props) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [tab, setTab] = useState<Tab>("payroll");

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-green">Monthly billable hours</h2>
          <p className="mt-1 max-w-3xl text-sm text-brand-black/70">
            One team member list for payroll actuals (including WRT and Job Coaching) with expected
            hours from KRA IJP/TSE clients only, plus the KRA expectations tab. Defaults to the
            current month (America/New_York).
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-brand-black/70">Month</span>
          <input
            type="month"
            className="rounded-md border border-neutral-300 px-3 py-2 text-brand-black"
            value={`${monthKey}-01`}
            onChange={(e) => setMonthKey(e.target.value.slice(0, 7))}
          />
        </label>
      </div>

      <div className="mt-4 flex gap-2 border-b border-neutral-200">
        <button
          type="button"
          onClick={() => setTab("payroll")}
          className={
            tab === "payroll"
              ? "border-b-2 border-brand-green px-3 py-2 text-sm font-semibold text-brand-green"
              : "px-3 py-2 text-sm font-medium text-brand-black/60 hover:text-brand-black"
          }
        >
          Monthly billable hours (payroll)
        </button>
        <button
          type="button"
          onClick={() => setTab("kra")}
          className={
            tab === "kra"
              ? "border-b-2 border-brand-green px-3 py-2 text-sm font-semibold text-brand-green"
              : "px-3 py-2 text-sm font-medium text-brand-black/60 hover:text-brand-black"
          }
        >
          Client billable expectations (KRA)
        </button>
      </div>

      {tab === "payroll" ? (
        <BillableHoursPayrollMonthlyPanel
          initialMonthKey={monthKey}
          monthKey={monthKey}
          onMonthKeyChange={setMonthKey}
          embedded
        />
      ) : (
        <BillableHoursKraCompliancePanel
          initialMonthKey={monthKey}
          monthKey={monthKey}
          onMonthKeyChange={setMonthKey}
          canCloseMonth={canCloseKraMonth}
          embedded
        />
      )}
    </section>
  );
}
