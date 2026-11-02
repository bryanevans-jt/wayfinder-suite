import { NextResponse, type NextRequest } from "next/server";
import type { WayfinderAppKind } from "./middleware-app-types";

const AUTH_CALLBACK_PATH = "/auth/callback";
const AUTH_CONFIRM_PATH = "/auth/confirm";
const AUTH_ACCESS_PATH = "/auth/access";

/**
 * Supabase emails sometimes land on Site URL root (`/?token_hash=…`) when RedirectTo
 * is the app origin or the dashboard template was not re-pasted. Route to confirm/callback.
 */
export function redirectStrayEmailAuthParams(
  request: NextRequest,
  context: { app: WayfinderAppKind }
): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith(AUTH_CALLBACK_PATH) ||
    pathname.startsWith(AUTH_CONFIRM_PATH) ||
    pathname.startsWith(AUTH_ACCESS_PATH) ||
    pathname.startsWith("/api/auth")
  ) {
    return null;
  }

  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const code = params.get("code");
  const tokenHashParam = params.get("token_hash");
  const tokenParam = params.get("token");

  if (
    context.app === "staff" &&
    tokenParam &&
    !type &&
    !tokenHashParam &&
    pathname !== AUTH_ACCESS_PATH
  ) {
    const url = request.nextUrl.clone();
    url.pathname = AUTH_ACCESS_PATH;
    return NextResponse.redirect(url);
  }

  const tokenHash = tokenHashParam ?? (type ? tokenParam : null);

  if (tokenHash && type) {
    const url = request.nextUrl.clone();
    url.pathname = context.app === "staff" ? AUTH_CONFIRM_PATH : AUTH_CALLBACK_PATH;
    url.searchParams.set("token_hash", tokenHash);
    url.searchParams.set("type", type);
    url.searchParams.delete("token");
    return NextResponse.redirect(url);
  }

  if (code) {
    const url = request.nextUrl.clone();
    url.pathname = AUTH_CALLBACK_PATH;
    return NextResponse.redirect(url);
  }

  return null;
}
