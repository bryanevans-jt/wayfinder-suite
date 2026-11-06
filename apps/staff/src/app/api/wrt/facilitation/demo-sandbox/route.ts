import { jsonWrtError, requireWrtCurriculumSession, wrtOk } from "@/lib/staff-wrt-auth";
import { ensureWrtDemoSandboxClient } from "@/lib/staff-wrt-facilitation";
import { NextRequest } from "next/server";

/** Admin / Super Admin: ensure the WRT demo sandbox client exists and is enrolled in all modules. */
export async function POST(_request: NextRequest) {
  const route = "api/wrt/facilitation/demo-sandbox";
  try {
    const { admin, userId } = await requireWrtCurriculumSession(true);
    const result = await ensureWrtDemoSandboxClient(admin, userId);
    return wrtOk(result);
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
