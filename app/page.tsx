import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { homeForRole, type Role } from '@/lib/roles';

// The middleware already routes by role; this is a safety net for the root.
export default async function Index() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  redirect(homeForRole((profile?.role ?? null) as Role | null));
}
