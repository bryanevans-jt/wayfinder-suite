import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { fetchAllPostgrestRows } from "@wayfinder/supabase/postgrest-fetch-all";
import { loadBlockedPreEtsServiceMonths } from "@wayfinder/supabase/pre-ets-field-release";
import { loadPreEtsAssignedSchoolIds } from "@wayfinder/supabase/pre-ets-staff-assignments";
import {
  filterAuthorizationsForFieldGate,
  isPreEtsAuthorizationVisibleToRole,
  preEtsReleasedAuthorizationGateApplies,
} from "@/lib/pre-ets-field-gate";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import {
  isPreEtsServiceMonthFilterOmitted,
  parsePreEtsServiceMonthFilter,
} from "@/lib/pre-ets-service-month";
import { NextResponse } from "next/server";

type AuthorizationListRow = {
  id: string;
  auth_number: string | null;
  auth_type: string;
  field_released_at: string | null;
  service_code: string;
  service_label: string | null;
  service_month: string;
  status: string;
  school_id: string;
  pre_ets_schools: { name: string } | { name: string }[] | null;
  pre_ets_program_groups: {
    group_name: string;
    instructor_name: string | null;
    class_time: string | null;
  } | {
    group_name: string;
    instructor_name: string | null;
    class_time: string | null;
  }[] | null;
};

function schoolName(row: AuthorizationListRow): string {
  const raw = row.pre_ets_schools;
  const school = Array.isArray(raw) ? raw[0] : raw;
  return school?.name ?? "";
}

export async function GET(request: Request) {
  const route = "api/pre-ets/authorizations";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId");
  const month = url.searchParams.get("month");
  const studentId = url.searchParams.get("studentId");
  const authType = url.searchParams.get("authType");

  try {
    const admin = createServiceRoleClient();

    const blockedMonths = await loadBlockedPreEtsServiceMonths(admin);

    if (studentId) {
      const { data: entries } = await admin
        .from("pre_ets_roster_entries")
        .select(
          "id, units_approved, authorization_id, pre_ets_authorizations(id, auth_number, auth_type, field_released_at, service_code, service_month, service_label, school_id, pre_ets_schools(name))"
        )
        .eq("student_id", studentId)
        .is("removed_at", null);

      const { data: ytd } = await admin
        .from("pre_ets_student_ytd_units")
        .select("billable_units, school_year")
        .eq("student_id", studentId)
        .maybeSingle();

      const gate = preEtsReleasedAuthorizationGateApplies(auth.role, auth.settings);
      const visibleEntries = gate
        ? (entries ?? []).filter((entry) => {
            const raw = entry.pre_ets_authorizations as
              | {
                  auth_number: string | null;
                  auth_type: string;
                  field_released_at?: string | null;
                  service_month?: string | null;
                }
              | {
                  auth_number: string | null;
                  auth_type: string;
                  field_released_at?: string | null;
                  service_month?: string | null;
                }[]
              | null;
            const row = Array.isArray(raw) ? raw[0] : raw;
            return isPreEtsAuthorizationVisibleToRole(
              row,
              auth.role,
              auth.settings,
              blockedMonths
            );
          })
        : (entries ?? []);

      return NextResponse.json({ authorizations: visibleEntries, ytd });
    }

    let serviceMonthFilter: string | null = null;
    if (!isPreEtsServiceMonthFilterOmitted(month)) {
      const parsed = parsePreEtsServiceMonthFilter(month);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      serviceMonthFilter = parsed.serviceMonth;
    }

    const assignedSchoolIds = await loadPreEtsAssignedSchoolIds(
      admin,
      auth.userId,
      auth.role
    );
    if (assignedSchoolIds && assignedSchoolIds.length === 0) {
      return NextResponse.json({ authorizations: [] });
    }

    // Fetch every matching A&I — a hard limit(100) hid Peach's second roster among 132 Dec rows.
    const data = await fetchAllPostgrestRows<AuthorizationListRow>(
      admin,
      "pre_ets_authorizations",
      "id, auth_number, auth_type, field_released_at, service_code, service_label, service_month, status, school_id, pre_ets_schools(name), pre_ets_program_groups(group_name, instructor_name, class_time)",
      {
        order: { column: "service_month", ascending: false },
        applyFilters: (query) => {
          let filtered = query;
          if (schoolId) filtered = filtered.eq("school_id", schoolId);
          if (serviceMonthFilter) {
            filtered = filtered.eq("service_month", serviceMonthFilter);
          }
          if (authType && authType !== "all") {
            filtered = filtered.eq("auth_type", authType);
          }
          if (assignedSchoolIds) {
            filtered = filtered.in("school_id", assignedSchoolIds);
          }
          return filtered;
        },
      }
    );

    const gate = preEtsReleasedAuthorizationGateApplies(auth.role, auth.settings);
    const authorizations = filterAuthorizationsForFieldGate(
      data,
      gate,
      blockedMonths
    ).sort((a, b) => {
      const bySchool = schoolName(a).localeCompare(schoolName(b));
      if (bySchool !== 0) return bySchool;
      const aNum = (a.auth_number ?? "").trim();
      const bNum = (b.auth_number ?? "").trim();
      if (aNum && bNum) {
        const byAuth = aNum.localeCompare(bNum, undefined, { numeric: true });
        if (byAuth !== 0) return byAuth;
      } else if (aNum !== bNum) {
        return aNum ? -1 : 1;
      }
      return a.id.localeCompare(b.id);
    });

    return NextResponse.json({ authorizations });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
