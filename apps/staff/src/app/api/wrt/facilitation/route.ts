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
    await seedWrtCurriculumIfEmpty(admin);

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
