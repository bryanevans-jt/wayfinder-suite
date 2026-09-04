"use client";

import { buildJtReportsPrefillUrl } from "@wayfinder/branding";
import {
  isAdminTierRole,
  isFieldSpecialistRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ReportAlert = {
  id: string;
  alertType: "missing" | "overdue";
  reportingMonth: string;
  clientId: string;
  clientName: string;
  esUserId: string;
  dueAt: string | null;
  createdAt: string;
};

type Props = {
  staffRole: string | null;
};

const DISMISS_STORAGE_KEY = "wayfinder-report-alerts-dismissed";

function showAlertsForRole(staffRole: string | null): boolean {
  return (
    isFieldSpecialistRole(staffRole) ||
    isSupervisorRole(staffRole) ||
    isAdminTierRole(staffRole)
  );
}

function alertFingerprint(alerts: ReportAlert[]): string {
  return alerts
    .map((a) => a.id)
    .sort()
    .join(",");
}

export function ReportAlertsBanner({ staffRole }: Props) {
  const [alerts, setAlerts] = useState<ReportAlert[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissedFp, setDismissedFp] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissedFp(sessionStorage.getItem(DISMISS_STORAGE_KEY));
    } catch {
      setDismissedFp(null);
    }
  }, []);

  const load = useCallback(async () => {
    if (!showAlertsForRole(staffRole)) {
      setAlerts([]);
      return;
    }
    try {
      const res = await fetch("/api/report-alerts");
      const data = (await res.json()) as { alerts?: ReportAlert[] };
      if (res.ok) {
        setAlerts(data.alerts ?? []);
      }
    } catch {
      // Keep prior alerts on network blips — never flash an empty checking state.
    }
  }, [staffRole]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 5 * 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const fingerprint = useMemo(() => alertFingerprint(alerts), [alerts]);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_STORAGE_KEY, fingerprint);
    } catch {
      // Ignore storage failures; still hide for this mount.
    }
    setDismissedFp(fingerprint);
    setExpanded(false);
  }

  if (!showAlertsForRole(staffRole) || alerts.length === 0 || dismissedFp === fingerprint) {
    return null;
  }

  const overdueCount = alerts.filter((a) => a.alertType === "overdue").length;
  const missingCount = alerts.filter((a) => a.alertType === "missing").length;
  const tone =
    overdueCount > 0
      ? "border-red-300 bg-red-50 text-red-900"
      : "border-amber-300 bg-amber-50 text-amber-950";

  const summaryParts: string[] = [];
  if (overdueCount > 0) summaryParts.push(`${overdueCount} overdue`);
  if (missingCount > 0) summaryParts.push(`${missingCount} missing`);

  return (
    <div className={`mx-4 mt-3 rounded-lg border px-4 py-3 lg:mx-6 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">SE Monthly report alerts</p>
          <p className="text-sm opacity-90">
            {`${summaryParts.join(", ")} GVRA report${alerts.length === 1 ? "" : "s"} need attention.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/reporting"
            className="rounded-lg border border-current/20 px-3 py-1.5 text-sm font-medium hover:bg-white/40"
          >
            Open reporting
          </Link>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-current/20 px-3 py-1.5 text-sm font-medium hover:bg-white/40"
          >
            {expanded ? "Hide" : "Show list"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg border border-current/20 px-3 py-1.5 text-sm font-medium hover:bg-white/40"
          >
            Dismiss
          </button>
        </div>
      </div>

      {expanded ? (
        <ul className="mt-3 space-y-2 border-t border-current/10 pt-3">
          {alerts.slice(0, 20).map((alert) => (
            <li key={alert.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-medium capitalize">{alert.alertType}</span>
                {" — "}
                {alert.clientName}
                <span className="opacity-75"> ({alert.reportingMonth})</span>
              </span>
              <a
                href={buildJtReportsPrefillUrl({
                  clientName: alert.clientName,
                  wayfinderClientId: alert.clientId,
                  report: "seMonthly",
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
              >
                Submit report
              </a>
            </li>
          ))}
          {alerts.length > 20 ? (
            <li className="text-sm opacity-75">+ {alerts.length - 20} more</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
