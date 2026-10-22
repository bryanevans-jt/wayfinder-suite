import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { fetchAllPostgrestRows } from "@wayfinder/supabase/postgrest-fetch-all";
import { isDefaultPortalClientsListRow } from "@/lib/client-pipeline-where";
import { filterOfficesForPicker, queryAllOffices } from "@/lib/office-visibility";

export type OfficeCaseCountRow = {
  officeId: string;
  officeName: string;
  caseCount: number;
};

type ClientCountRow = {
  office_id: string | null;
  archived_at?: string | null;
};

export function aggregateOfficeCaseCounts(
  offices: { id: string; name: string }[],
  clients: ClientCountRow[]
): OfficeCaseCountRow[] {
  const counts = new Map<string, number>();

  for (const row of clients) {
    if (!isDefaultPortalClientsListRow(row)) continue;
    const officeId = row.office_id;
    if (!officeId) continue;
    counts.set(officeId, (counts.get(officeId) ?? 0) + 1);
  }

  return offices
    .map((office) => ({
      officeId: office.id,
      officeName: office.name,
      caseCount: counts.get(office.id) ?? 0,
    }))
    .sort((a, b) => {
      if (b.caseCount !== a.caseCount) return b.caseCount - a.caseCount;
      return a.officeName.localeCompare(b.officeName, undefined, { sensitivity: "base" });
    });
}

/** Active client rows per office — matches Admin portal Clients list (default, not archived). */
export async function loadOfficeCaseCounts(): Promise<OfficeCaseCountRow[]> {
  const admin = createServiceRoleClient();

  const [officesRaw, clientRows] = await Promise.all([
    queryAllOffices(admin),
    fetchAllPostgrestRows<ClientCountRow>(admin, "clients", "office_id, archived_at"),
  ]);

  return aggregateOfficeCaseCounts(filterOfficesForPicker(officesRaw), clientRows);
}
