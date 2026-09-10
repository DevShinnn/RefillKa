'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FIELD_LOGIN, OPS_LOGIN, homeForRole, isFieldRole, isOpsRole, type Role } from '@/lib/roles';
import { loginToEmail } from '@/lib/loginId';

export type LoginState = { error: string | null };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const loginId = String(formData.get('login_id') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const portal = String(formData.get('portal') ?? 'field') === 'ops' ? 'ops' : 'field';

  if (!loginId || !password) return { error: 'Enter your ID and PIN.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: loginToEmail(loginId),
    password,
  });
  if (error) return { error: 'Sign-in failed — check your ID and PIN.' };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const role = (profile?.role ?? null) as Role | null;

  if (portal === 'field' && !isFieldRole(role)) {
    await supabase.auth.signOut();
    return { error: 'This page is for CENRO. Use /ops for operations.' };
  }
  if (portal === 'ops' && !isOpsRole(role)) {
    await supabase.auth.signOut();
    return { error: 'This page is for operations. Use /login for CENRO.' };
  }

  redirect(homeForRole(role));
}

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
