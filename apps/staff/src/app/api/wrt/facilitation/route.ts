import { jsonWrtError, requireWrtCurriculumSession, wrtOk } from "@/lib/staff-wrt-auth";
import {
  loadClientFacilitationSnapshot,
  searchClientsForWrt,
} from "@/lib/staff-wrt-facilitation";
import { seedWrtCurriculumIfEmpty } from "@/lib/staff-wrt-data";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const route = "api/wrt/facilitation";
  try {
    const { admin } = await requireWrtCurriculumSession(false);

    try {
      await seedWrtCurriculumIfEmpty(admin);
    } catch (seedErr) {
      const msg = seedErr instanceof Error ? seedErr.message : String(seedErr);
      if (/relation .* does not exist|Could not find the table/i.test(msg)) {
        return wrtOk(
          {
            error:
              "WRT database tables are not set up yet. Run the WRT curriculum and facilitation migrations in Supabase, then refresh.",
            clients: [],
          },
          { status: 503 }
        );
      }
      throw seedErr;
    }

    const clientId = request.nextUrl.searchParams.get("clientId")?.trim();
    const q = request.nextUrl.searchParams.get("q");

    if (q !== null && !clientId) {
      const clients = await searchClientsForWrt(admin, q);
      return wrtOk({ clients });
    }

    if (!clientId) {
      const clients = await searchClientsForWrt(admin, "");
      return wrtOk({ clients });
    }

    const snapshot = await loadClientFacilitationSnapshot(admin, clientId);
    return wrtOk(snapshot);
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
