import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { loadStaffNameById } from "@/lib/staff-names";
import {
  filterSunsetCounselors,
  filterSunsetOffices,
  loadSunsetKeepIds,
} from "@/lib/sunset-tn";

type Admin = ReturnType<typeof createServiceRoleClient>;

export type HospitalitySupervisorOption = {
  id: string;
  name: string;
  primaryOfficeId: string | null;
};

export type HospitalityOfficeOption = {
  id: string;
  name: string;
  state: string | null;
};

export type HospitalityCounselorOption = {
  id: string;
  name: string;
  email: string | null;
  officeIds: string[];
};

export async function loadHospitalityIntakeOptions(admin: Admin): Promise<{
  supervisors: HospitalitySupervisorOption[];
  offices: HospitalityOfficeOption[];
  counselors: HospitalityCounselorOption[];
}> {
  const [{ data: supervisorRows }, { data: officeRows }, { data: counselorRows }, { data: counselorOffices }] =
    await Promise.all([
      admin.from("profiles").select("id").eq("role", "supervisor").eq("is_active", true),
      admin.from("offices").select("id, name, state").order("name"),
      admin
        .from("counselors")
        .select("id, full_name, contact_email, office_id")
        .order("full_name"),
      admin.from("counselor_office_assignments").select("counselor_id, office_id"),
    ]);

  const supervisorIds = (supervisorRows ?? []).map((r) => r.id as string);
  const nameById = await loadStaffNameById(admin, supervisorIds, "Supervisor");

  const { data: assignments } = supervisorIds.length
    ? await admin
        .from("staff_office_assignments")
        .select("user_id, office_id")
        .in("user_id", supervisorIds)
    : { data: [] as { user_id: string; office_id: string }[] };

  const primaryOfficeByUser = new Map<string, string>();
  for (const row of assignments ?? []) {
    const userId = row.user_id as string;
    if (!primaryOfficeByUser.has(userId)) {
      primaryOfficeByUser.set(userId, row.office_id as string);
    }
  }

  const sunset = await loadSunsetKeepIds(admin);

  const supervisors = supervisorIds
    .map((id) => ({
      id,
      name: nameById.get(id) ?? "Supervisor",
      primaryOfficeId: primaryOfficeByUser.get(id) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    supervisors,
    offices: filterSunsetOffices(
      (officeRows ?? []).map((o) => ({
        id: o.id as string,
        name: o.name as string,
        state: (o.state as string | null) ?? null,
      })),
      sunset.keepOfficeIds
    ),
    counselors: filterSunsetCounselors(
      (counselorRows ?? []).map((c) => {
        const officeIds = new Set<string>();
        if (c.office_id) officeIds.add(c.office_id as string);
        for (const link of counselorOffices ?? []) {
          if (link.counselor_id === c.id && link.office_id) {
            officeIds.add(link.office_id as string);
          }
        }
        return {
          id: c.id as string,
          name: (c.full_name as string) || "Counselor",
          email: (c.contact_email as string | null) ?? null,
          office_id: (c.office_id as string | null) ?? null,
          office_ids: [...officeIds],
          officeIds: [...officeIds],
        };
      }),
      sunset
    ).map(({ office_id: _officeId, office_ids: _officeIds, ...counselor }) => counselor),
  };
}
