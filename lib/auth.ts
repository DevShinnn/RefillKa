import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FIELD_LOGIN, homeForRole, loginPathFor, type Role } from '@/lib/roles';
import type { Profile } from '@/lib/types';

/**
 * Server-side guard for a protected page. Verifies the session, loads the
 * profile, and enforces the allowed roles (defense in depth on top of
 * middleware). Redirects otherwise.
 */
export async function requireProfile(allowed: Role[]) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  const loginPath = allowed.includes('cenro') ? FIELD_LOGIN : loginPathFor('/admin');
  if (!user) redirect(loginPath);

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  if (!profile) redirect(loginPath);
  if (!allowed.includes(profile.role)) redirect(homeForRole(profile.role));

  return { supabase, user, profile };
}
