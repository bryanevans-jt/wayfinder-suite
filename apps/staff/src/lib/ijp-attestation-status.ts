import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attestationCaptureWindowOpen,
  clientHasBillableTimeInMonth,
  clientOnGaIjpDuringMonth,
  currentServiceMonthStart,
  priorServiceMonthStart,
  serviceMonthLabel,
} from "@wayfinder/supabase/ijp-billing-eligibility";
import { resolveGaIjpServiceId } from "@wayfinder/supabase/ijp-billing-settings";
import { localDateStringInTz, STAFF_CLOCK_TIMEZONE } from "@wayfinder/supabase/staff-time-clock-shared";

export type IjpSignatureUiStatus = {
  serviceMonth: string;
  serviceMonthLabel: string;
  signatureNeeded: boolean;
  hasAttestation: boolean;
  showListFlag: boolean;
  captureOpen: boolean;
  isTest: false;
};

function isOnOrAfter25thForMonth(monthStart: string, now: Date): boolean {
  const ymd = localDateStringInTz(now, STAFF_CLOCK_TIMEZONE);
  const [y, m, d] = ymd.split("-").map(Number);
  const [msY, msM] = monthStart.split("-").map(Number);
  if (y > msY || (y === msY && m > msM)) return true;
  if (y === msY && m === msM && d >= 25) return true;
  return false;
}

/** Production attestation UI state for profile / client lists (never includes test rows). */
export async function loadIjpSignatureUiStatus(
  admin: SupabaseClient,
  clientId: string,
  now = new Date()
): Promise<IjpSignatureUiStatus | null> {
  const gaIjpServiceId = await resolveGaIjpServiceId(admin);
  if (!gaIjpServiceId) return null;

  const monthStart = currentServiceMonthStart(now);
  const onIjp = await clientOnGaIjpDuringMonth(admin, clientId, monthStart, gaIjpServiceId);
  if (!onIjp) {
    const prior = priorServiceMonthStart(now);
    if (attestationCaptureWindowOpen(prior, now)) {
      const onPrior = await clientOnGaIjpDuringMonth(admin, clientId, prior, gaIjpServiceId);
      if (onPrior) {
        return loadForMonth(admin, clientId, prior, now);
      }
    }
    return null;
  }

  if (attestationCaptureWindowOpen(monthStart, now)) {
    return loadForMonth(admin, clientId, monthStart, now);
  }

  const prior = priorServiceMonthStart(now);
  if (attestationCaptureWindowOpen(prior, now)) {
    return loadForMonth(admin, clientId, prior, now);
  }

  return loadForMonth(admin, clientId, monthStart, now);
}

async function loadForMonth(
  admin: SupabaseClient,
  clientId: string,
  monthStart: string,
  now: Date
): Promise<IjpSignatureUiStatus | null> {
  const gaIjpServiceId = await resolveGaIjpServiceId(admin);
  if (!gaIjpServiceId) return null;

  const onIjp = await clientOnGaIjpDuringMonth(admin, clientId, monthStart, gaIjpServiceId);
  if (!onIjp) return null;

  const hasBillable = await clientHasBillableTimeInMonth(admin, clientId, monthStart);
  const { data: att } = await admin
    .from("ijp_monthly_attestations")
    .select("id")
    .eq("client_id", clientId)
    .eq("service_month", monthStart)
    .eq("is_test", false)
    .not("attestation_drive_file_id", "is", null)
    .maybeSingle();

  const hasAttestation = Boolean(att?.id);
  const signatureNeeded = hasBillable && !hasAttestation;
  const showListFlag = signatureNeeded && isOnOrAfter25thForMonth(monthStart, now);

  return {
    serviceMonth: monthStart,
    serviceMonthLabel: serviceMonthLabel(monthStart),
    signatureNeeded,
    hasAttestation,
    showListFlag,
    captureOpen: attestationCaptureWindowOpen(monthStart, now),
    isTest: false,
  };
}
