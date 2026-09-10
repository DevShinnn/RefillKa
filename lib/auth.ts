import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { homeForRole, type Role } from '@/lib/roles';
import type { Profile } from '@/lib/types';

/**
 * Server-side guard for a protected page. Verifies the session, loads the
 * profile, and enforces the allowed roles (defense in depth on top of
 * middleware). Redirects otherwise.
 */
export async function requireProfile(allowed: Role[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  if (!profile) redirect('/login');
  if (!allowed.includes(profile.role)) redirect(homeForRole(profile.role));

  return { supabase, user, profile };
}
