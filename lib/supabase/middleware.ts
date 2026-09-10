import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { FIELD_LOGIN, OPS_LOGIN, canAccess, homeForRole, loginPathFor, roleFromAuthUser } from '@/lib/roles';

function hasAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.includes('-auth-token'));
}

function withNoStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  return response;
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return withNoStore(NextResponse.redirect(url));
}

/**
 * Refreshes the Supabase session cookie on guarded routes and routes by role.
 * Login screens skip the Auth network hop when there is no session cookie.
 */
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isLoginSurface = path === FIELD_LOGIN || path === OPS_LOGIN;

  if (!hasAuthCookie(request)) {
    if (isLoginSurface) return withNoStore(NextResponse.next({ request }));
    return redirectTo(request, path === '/' ? FIELD_LOGIN : loginPathFor(path));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as any)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isLoginSurface) return withNoStore(response);
    return redirectTo(request, loginPathFor(path));
  }

  let role = roleFromAuthUser(user);
  if (!role) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    role = profile?.role ?? null;
  }

  if (path === FIELD_LOGIN || path === '/') {
    return redirectTo(request, homeForRole(role));
  }

  if (!canAccess(role, path)) {
    return redirectTo(request, homeForRole(role));
  }

  return withNoStore(response);
}
