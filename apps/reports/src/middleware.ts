import { createServerClient } from '@supabase/ssr';
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  type SupabaseCookieToSet,
} from '@wayfinder/supabase';
import { reportsServerAuthOptions } from '@/lib/supabase/auth-options';
import { NextResponse, type NextRequest } from 'next/server';

const ORG_DOMAIN = 'thejoshuatree.org';
const REPORTING_ROLES = new Set(['es', 'supervisor', 'admin', 'super_admin']);

async function loadReportingRole(
  supabase: ReturnType<typeof createServerClient>
): Promise<string | null> {
  const { data: rpcRows, error } = await supabase.rpc('get_auth_user_profile');
  if (!error && rpcRows) {
    const row = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as { role?: string } | undefined;
    if (row?.role) {
      return String(row.role).toLowerCase();
    }
  }
  return null;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  let supabaseUrl: string;
  let supabaseAnonKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    supabaseAnonKey = getSupabaseAnonKey();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Missing Supabase environment variables.';
    return new NextResponse(
      `Reports configuration error: ${message}\n\nSet NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on this Vercel project.`,
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    ...reportsServerAuthOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: SupabaseCookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthCallback = request.nextUrl.pathname.startsWith('/auth/');
  const isLogin = request.nextUrl.pathname === '/login';
  const isApi = request.nextUrl.pathname.startsWith('/api/');

  if (isAuthCallback || isApi) {
    return response;
  }

  if (!user) {
    if (isLogin) return response;
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    redirect.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(redirect);
  }

  const email = user.email || '';
  if (!email.endsWith(`@${ORG_DOMAIN}`)) {
    await supabase.auth.signOut();
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    redirect.searchParams.set('error', 'org_only');
    return NextResponse.redirect(redirect);
  }

  const role = (await loadReportingRole(supabase)) ?? '';
  if (!REPORTING_ROLES.has(role)) {
    const staffUrl = process.env.NEXT_PUBLIC_STAFF_APP_URL?.replace(/\/$/, '') || '';
    if (staffUrl) {
      return NextResponse.redirect(`${staffUrl}/dashboard`);
    }
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    redirect.searchParams.set('error', 'forbidden');
    return NextResponse.redirect(redirect);
  }

  if (isLogin) {
    const next = request.nextUrl.searchParams.get('next');
    const redirect = request.nextUrl.clone();
    redirect.pathname = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    redirect.search = '';
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
