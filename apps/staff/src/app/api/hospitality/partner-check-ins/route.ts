import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import {
  canLogHospitalityCheckIns,
  canViewHospitalityWorkspace,
} from "@wayfinder/supabase/roles";
import { loadStaffNameById } from "@/lib/staff-names";
import {
  checkInOutcomeLabel,
  contactMonthStart,
  isCheckInOutcome,
  monthLabel,
} from "@/lib/hospitality-check-ins";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session || !canViewHospitalityWorkspace(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const employerId = url.searchParams.get("employerId");
  const admin = createServiceRoleClient();
  const month = contactMonthStart();

  if (employerId) {
    const { data, error } = await admin
      .from("hospitality_partner_contacts")
      .select("id, employer_id, contacted_by, contacted_at, contact_month, outcome, notes")
      .eq("employer_id", employerId)
      .order("contacted_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const staffIds = [...new Set((data ?? []).map((r) => r.contacted_by as string))];
    const names = await loadStaffNameById(admin, staffIds, "Staff");

    return NextResponse.json({
      month,
      monthLabel: monthLabel(month),
      contacts: (data ?? []).map((r) => ({
        id: r.id as string,
        employer_id: r.employer_id as string,
        contacted_by: r.contacted_by as string,
        contacted_by_name: names.get(r.contacted_by as string) ?? "Staff",
        contacted_at: r.contacted_at as string,
        contact_month: r.contact_month as string,
        outcome: r.outcome as string,
        outcome_label: checkInOutcomeLabel(r.outcome as string),
        notes: (r.notes as string | null) ?? null,
      })),
    });
  }

  const [{ data: employers, error: employerError }, { data: contacts, error: contactError }] =
    await Promise.all([
      admin
        .from("employers")
        .select("id, name, status, city, state, contact_phone, contact_email")
        .order("name")
        .limit(5000),
      admin
        .from("hospitality_partner_contacts")
        .select("id, employer_id, contacted_at, outcome, notes, contacted_by")
        .eq("contact_month", month)
        .order("contacted_at", { ascending: false }),
    ]);

  if (employerError) {
    return NextResponse.json({ error: employerError.message }, { status: 500 });
  }
  if (contactError) {
    return NextResponse.json({ error: contactError.message }, { status: 500 });
  }

  const latestByEmployer = new Map<
    string,
    { contacted_at: string; outcome: string; notes: string | null }
  >();
  for (const row of contacts ?? []) {
    const id = row.employer_id as string;
    if (!latestByEmployer.has(id)) {
      latestByEmployer.set(id, {
        contacted_at: row.contacted_at as string,
        outcome: row.outcome as string,
        notes: (row.notes as string | null) ?? null,
      });
    }
  }

  const rows = (employers ?? [])
    .map((e) => {
      const id = e.id as string;
      const last = latestByEmployer.get(id);
      return {
        id,
        name: (e.name as string) || "Community partner",
        status: ((e.status as string | null) ?? "unknown") as string,
        city: (e.city as string | null) ?? null,
        state: (e.state as string | null) ?? null,
        contact_phone: (e.contact_phone as string | null) ?? null,
        contact_email: (e.contact_email as string | null) ?? null,
        contacted_this_month: Boolean(last),
        last_contacted_at: last?.contacted_at ?? null,
        last_outcome: last?.outcome ?? null,
        last_outcome_label: last ? checkInOutcomeLabel(last.outcome) : null,
        last_notes: last?.notes ?? null,
      };
    })
    .sort((a, b) => {
      if (a.contacted_this_month !== b.contacted_this_month) {
        return a.contacted_this_month ? 1 : -1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

  const contacted = rows.filter((r) => r.contacted_this_month).length;

  return NextResponse.json({
    month,
    monthLabel: monthLabel(month),
    total: rows.length,
    contacted,
    remaining: rows.length - contacted,
    partners: rows,
  });
}

export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session || !canLogHospitalityCheckIns(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await assertNotPreviewMutation();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Read-only preview" },
      { status: 403 }
    );
  }

  const body = (await request.json()) as {
    employerId?: string;
    outcome?: string;
    notes?: string;
  };
  const employerId = (body.employerId ?? "").trim();
  const outcome = (body.outcome ?? "reached").trim();
  const notes = (body.notes ?? "").trim() || null;

  if (!employerId) {
    return NextResponse.json({ error: "employerId is required" }, { status: 400 });
  }
  if (!isCheckInOutcome(outcome)) {
    return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
  }
  if (notes && notes.length > 2000) {
    return NextResponse.json({ error: "Notes are too long" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: employer } = await admin
    .from("employers")
    .select("id")
    .eq("id", employerId)
    .maybeSingle();
  if (!employer) {
    return NextResponse.json({ error: "Community partner not found" }, { status: 404 });
  }

  const now = new Date();
  const { data, error } = await admin
    .from("hospitality_partner_contacts")
    .insert({
      employer_id: employerId,
      contacted_by: session.effectiveUserId,
      contacted_at: now.toISOString(),
      contact_month: contactMonthStart(now),
      outcome,
      notes,
    })
    .select("id, contacted_at, outcome, notes")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not save contact" }, { status: 500 });
  }

  return NextResponse.json({
    contact: {
      id: data.id as string,
      contacted_at: data.contacted_at as string,
      outcome: data.outcome as string,
      outcome_label: checkInOutcomeLabel(data.outcome as string),
      notes: (data.notes as string | null) ?? null,
    },
  });
}
