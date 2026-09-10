import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { homeForRole, canAccess, type Role } from '@/lib/roles';

/**
 * Refreshes the Supabase session cookie on every request and guards routes
 * by role. Runs in the Edge middleware.
 */
export async function updateSession(request: NextRequest) {
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

  // IMPORTANT: getUser() revalidates the token with Supabase (do not trust getSession here).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path === '/login';

  // Not signed in → only /login is allowed.
  if (!user) {
    if (isLogin) return response;
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Signed in: resolve role (from profile) for routing decisions.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = (profile?.role ?? null) as Role | null;

  // Signed in on /login or root → send to role home.
  if (isLogin || path === '/') {
    const url = request.nextUrl.clone();
    url.pathname = homeForRole(role);
    return NextResponse.redirect(url);
  }

  // Enforce per-route role access.
  if (!canAccess(role, path)) {
    const url = request.nextUrl.clone();
    url.pathname = homeForRole(role);
    return NextResponse.redirect(url);
  }

  return response;
}
