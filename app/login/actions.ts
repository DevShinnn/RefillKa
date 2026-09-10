'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FIELD_LOGIN, OPS_LOGIN, isOpsRole, type Role } from '@/lib/roles';

export async function signOut() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let path = FIELD_LOGIN;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (isOpsRole((profile?.role ?? null) as Role | null)) path = OPS_LOGIN;
  }
  await supabase.auth.signOut();
  redirect(path);
}
