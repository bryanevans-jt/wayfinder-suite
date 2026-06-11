import { handleWayfinderAuthCallback } from "@wayfinder/supabase/auth-callback";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return handleWayfinderAuthCallback(request);
}
