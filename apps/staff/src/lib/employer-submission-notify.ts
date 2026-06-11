import { clientDisplayName } from "@wayfinder/branding";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { notifyUser } from "@wayfinder/supabase/notify-user";
import {
  findClientMatchesForEmployer,
  type ClientMatchCandidate,
  type EmployerMatchCandidate,
} from "@/lib/employer-matching";

const CLIENT_SELECT =
  "id, user_id, contact_email, home_latitude, home_longitude, employment_goal_primary, employment_goal_primary_other, employment_goal_secondary, employment_goal_secondary_other";

type NotifyEmployer = EmployerMatchCandidate;

export async function notifyStaffOfPublicEmployerSubmission(employer: NotifyEmployer) {
  const admin = createServiceRoleClient();

  const { data: esAssignments } = await admin
    .from("es_client_assignments")
    .select("es_user_id, client_id");

  if (!esAssignments?.length) {
    return;
  }

  const clientIds = [...new Set(esAssignments.map((a) => a.client_id as string))];
  const { data: clientsRaw } = await admin.from("clients").select(CLIENT_SELECT).in("id", clientIds);

  const userIds = [...new Set((clientsRaw ?? []).map((c) => c.user_id as string).filter(Boolean))];
  const { data: profiles } =
    userIds.length > 0
      ? await admin.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null }[] };

  const nameByUser = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const clientsById = new Map<string, ClientMatchCandidate>();
  for (const c of clientsRaw ?? []) {
    clientsById.set(c.id as string, {
      id: c.id as string,
      label: clientDisplayName({
        full_name: nameByUser.get(c.user_id as string) ?? null,
        contact_email: c.contact_email as string | null,
        id: c.id as string,
      }),
      home_latitude: c.home_latitude as number | null,
      home_longitude: c.home_longitude as number | null,
      employment_goal_primary: c.employment_goal_primary as string | null,
      employment_goal_primary_other: c.employment_goal_primary_other as string | null,
      employment_goal_secondary: c.employment_goal_secondary as string | null,
      employment_goal_secondary_other: c.employment_goal_secondary_other as string | null,
    });
  }

  const clientsByEs = new Map<string, ClientMatchCandidate[]>();
  for (const row of esAssignments) {
    const esId = row.es_user_id as string;
    const client = clientsById.get(row.client_id as string);
    if (!client) continue;
    const list = clientsByEs.get(esId) ?? [];
    list.push(client);
    clientsByEs.set(esId, list);
  }

  const notifiedEs = new Set<string>();
  const notifiedSupervisors = new Set<string>();
  const officeIds = new Set<string>();

  const linkPath = `/dashboard/community-partners/${employer.id}`;
  const title = "New Community Partners employer";
  const body = `${employer.name} submitted a join request and may match clients near ${[employer.city, employer.state].filter(Boolean).join(", ") || "their location"}.`;

  for (const [esUserId, caseload] of clientsByEs) {
    const matches = findClientMatchesForEmployer(employer, caseload, { treatAsActive: true });
    if (matches.length === 0) continue;

    notifiedEs.add(esUserId);

    const { data: esOffices } = await admin
      .from("staff_office_assignments")
      .select("office_id")
      .eq("user_id", esUserId);

    for (const o of esOffices ?? []) {
      officeIds.add(o.office_id as string);
    }

    await notifyUser(admin, {
      userId: esUserId,
      kind: "employer_submission",
      title,
      body,
      link_path: linkPath,
      metadata: { employer_id: employer.id, match_count: matches.length },
      app: "staff",
    });
  }

  if (officeIds.size === 0) {
    return;
  }

  const officeIdList = [...officeIds];
  const { data: supervisorOfficeLinks } = await admin
    .from("staff_office_assignments")
    .select("user_id, office_id")
    .in("office_id", officeIdList);

  const candidateSupervisorIds = [
    ...new Set((supervisorOfficeLinks ?? []).map((r) => r.user_id as string)),
  ];

  if (candidateSupervisorIds.length === 0) {
    return;
  }

  const { data: supervisorProfiles } = await admin
    .from("profiles")
    .select("id, role")
    .in("id", candidateSupervisorIds)
    .eq("role", "supervisor");

  for (const sup of supervisorProfiles ?? []) {
    const supId = sup.id as string;
    if (notifiedSupervisors.has(supId) || notifiedEs.has(supId)) {
      continue;
    }
    const sharesOffice = (supervisorOfficeLinks ?? []).some(
      (link) =>
        link.user_id === supId && officeIdList.includes(link.office_id as string)
    );
    if (!sharesOffice) continue;

    notifiedSupervisors.add(supId);
    await notifyUser(admin, {
      userId: supId,
      kind: "employer_submission",
      title,
      body,
      link_path: linkPath,
      metadata: { employer_id: employer.id },
      app: "staff",
    });
  }
}
