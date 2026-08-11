import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { loadStaffNameById } from "@/lib/staff-names";

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
};

export async function loadHospitalityIntakeOptions(admin: Admin): Promise<{
  supervisors: HospitalitySupervisorOption[];
  offices: HospitalityOfficeOption[];
  counselors: HospitalityCounselorOption[];
}> {
  const [{ data: supervisorRows }, { data: officeRows }, { data: counselorRows }] =
    await Promise.all([
      admin.from("profiles").select("id").eq("role", "supervisor").eq("is_active", true),
      admin.from("offices").select("id, name, state").order("name"),
      admin.from("counselors").select("id, full_name, contact_email").order("full_name"),
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

  const supervisors = supervisorIds
    .map((id) => ({
      id,
      name: nameById.get(id) ?? "Supervisor",
      primaryOfficeId: primaryOfficeByUser.get(id) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    supervisors,
    offices: (officeRows ?? []).map((o) => ({
      id: o.id as string,
      name: o.name as string,
      state: (o.state as string | null) ?? null,
    })),
    counselors: (counselorRows ?? []).map((c) => ({
      id: c.id as string,
      name: (c.full_name as string) || "Counselor",
      email: (c.contact_email as string | null) ?? null,
    })),
  };
}
