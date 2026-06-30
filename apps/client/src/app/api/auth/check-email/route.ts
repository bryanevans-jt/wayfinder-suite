import { handleAuthCheckEmailRequest } from "@wayfinder/supabase";

export async function POST(request: Request) {
  return handleAuthCheckEmailRequest(request);
}
