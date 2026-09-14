import { provisionCounselorLoginForMagicLink } from "@/lib/portal-staff-users";
import { handleAuthCheckEmailRequest } from "@wayfinder/supabase";

export async function POST(request: Request) {
  return handleAuthCheckEmailRequest(request, {
    provisionLogin: (admin, email) => provisionCounselorLoginForMagicLink(admin, email),
  });
}
