'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loginToEmail, normalizeOfficerId } from '@/lib/loginId';
import { ASSIGNABLE_ROLES, roleNeedsLgu, roleNeedsRegion, type Role } from '@/lib/roles';
import { createClient as createJsClient } from '@supabase/supabase-js';
import type { Profile, Store } from '@/lib/types';
import { usageLines, usageTotal, type AccountUsage } from '@/lib/opsUsage';

export type AccountInput = {
  officerId: string;
  fullName: string;
  role: Role;
  lguId: string | null;
  regionId: string | null;
};

async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not signed in' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'superadmin') return { ok: false as const, error: 'Ops only' };
  return { ok: true as const, supabase, user };
}

function validateAccount(input: AccountInput, pin?: string) {
  const officerId = normalizeOfficerId(input.officerId);
  const fullName = input.fullName.trim();
  if (!officerId) return { ok: false as const, error: 'Enter a login ID' };
  if (!fullName) return { ok: false as const, error: 'Enter a name' };
  if (!ASSIGNABLE_ROLES.includes(input.role)) return { ok: false as const, error: 'Pick a role' };
  if (roleNeedsLgu(input.role) && !input.lguId) return { ok: false as const, error: 'Assign an LGU for this role' };
  if (roleNeedsRegion(input.role) && !input.regionId) return { ok: false as const, error: 'Assign a region for this role' };
  if (pin !== undefined && !/^\d{6}$/.test(pin)) return { ok: false as const, error: 'PIN must be 6 digits' };
  return { ok: true as const, officerId, fullName };
}

function scopeFor(role: Role, lguId: string | null, regionId: string | null) {
  if (roleNeedsLgu(role)) return { lgu_id: lguId, region_id: null as string | null };
  if (roleNeedsRegion(role)) return { lgu_id: null as string | null, region_id: regionId };
  return { lgu_id: lguId, region_id: regionId };
}

function pinAuthError(message: string | undefined): string {
  const text = message || 'Could not update PIN';
  if (/leaked|pwned|compromised|weak|hibp|known/i.test(text)) {
    return 'Supabase blocked that PIN because it is too common (123456 is rejected). Turn off Auth → Attack Protection → Leaked password protection, or use a less common 6-digit PIN.';
  }
  return text;
}

async function applyLoginPin(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  pin: string,
  officerId: string
): Promise<{ error: string | null }> {
  const email = loginToEmail(officerId);
  const { data: existing, error: loadErr } = await admin.auth.admin.getUserById(userId);
  if (loadErr || !existing.user) return { error: loadErr?.message || 'Login user was not found' };

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: pin,
    email,
    email_confirm: true,
  });
  if (error) return { error: pinAuthError(error.message) };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { error: 'Could not verify the new PIN on the server' };

  const probe = createJsClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: check } = await probe.auth.signInWithPassword({ email, password: pin });
  await probe.auth.signOut();
  if (check) return { error: pinAuthError(check.message) };
  return { error: null };
}

function metaFor(input: { officerId: string; fullName: string; role: Role; lguId: string | null; regionId: string | null }) {
  return {
    full_name: input.fullName,
    role: input.role,
    officer_id: input.officerId,
    lgu_id: input.lguId || '',
    region_id: input.regionId || '',
  };
}

export async function createAccount(
  input: AccountInput & { pin: string }
): Promise<{ error: string | null; account?: Profile }> {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { error: gate.error };

  const pin = input.pin.trim();
  const checked = validateAccount(input, pin);
  if (!checked.ok) return { error: checked.error };

  const scope = scopeFor(input.role, input.lguId, input.regionId);
  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Server admin key is missing' };
  }

  const { data: taken } = await admin
    .from('profiles')
    .select('id')
    .eq('officer_id', checked.officerId)
    .maybeSingle();
  if (taken) return { error: `ID ${checked.officerId} is already in use` };

  const { data, error } = await admin.auth.admin.createUser({
    email: loginToEmail(checked.officerId),
    password: pin,
    email_confirm: true,
    user_metadata: metaFor({
      officerId: checked.officerId,
      fullName: checked.fullName,
      role: input.role,
      lguId: scope.lgu_id,
      regionId: scope.region_id,
    }),
  });
  if (error || !data.user) return { error: pinAuthError(error?.message) || 'Could not create login' };

  const { data: account, error: loadErr } = await admin
    .from('profiles')
    .upsert({
      id: data.user.id,
      officer_id: checked.officerId,
      full_name: checked.fullName,
      role: input.role,
      lgu_id: scope.lgu_id,
      region_id: scope.region_id,
    })
    .select('*')
    .single<Profile>();
  if (loadErr || !account) {
    return { error: loadErr?.message || 'Login created, but the profile did not save. Check Database.' };
  }

  const pinCheck = await applyLoginPin(admin, data.user.id, pin, checked.officerId);
  if (pinCheck.error) return { error: pinCheck.error, account };

  return { error: null, account };
}

export async function updateAccount(
  userId: string,
  input: AccountInput & { pin?: string }
): Promise<{ error: string | null; account?: Profile }> {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { error: gate.error };

  const pin = input.pin?.trim();
  const checked = validateAccount(input, pin || undefined);
  if (!checked.ok) return { error: checked.error };
  if (userId === gate.user.id && input.role !== 'superadmin') {
    return { error: 'You cannot remove your own superadmin role' };
  }

  const scope = scopeFor(input.role, input.lguId, input.regionId);
  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Server admin key is missing' };
  }

  const profileRow = {
    officer_id: checked.officerId,
    full_name: checked.fullName,
    role: input.role,
    lgu_id: scope.lgu_id,
    region_id: scope.region_id,
  };

  let { data: account, error } = await gate.supabase
    .from('profiles')
    .update(profileRow)
    .eq('id', userId)
    .select('*')
    .single<Profile>();

  if (error || !account) {
    const adminWrite = await admin.from('profiles').update(profileRow).eq('id', userId).select('*').single<Profile>();
    account = adminWrite.data;
    error = adminWrite.error;
  }
  if (error || !account) return { error: error?.message || 'Could not update account' };

  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    email: loginToEmail(checked.officerId),
    email_confirm: true,
    user_metadata: metaFor({
      officerId: checked.officerId,
      fullName: checked.fullName,
      role: input.role,
      lguId: scope.lgu_id,
      regionId: scope.region_id,
    }),
  });
  if (authErr) return { error: authErr.message };

  if (pin) {
    const pinResult = await applyLoginPin(admin, userId, pin, checked.officerId);
    if (pinResult.error) return { error: pinResult.error };
  }

  return { error: null, account };
}

export async function resetPin(userId: string, pin: string): Promise<{ error: string | null }> {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { error: gate.error };
  const nextPin = pin.trim();
  if (!/^\d{6}$/.test(nextPin)) return { error: 'PIN must be 6 digits' };

  try {
    const admin = createAdminClient();
    const { data: account, error } = await admin.from('profiles').select('officer_id').eq('id', userId).single();
    if (error || !account?.officer_id) return { error: error?.message || 'This login has no officer ID' };
    return applyLoginPin(admin, userId, nextPin, account.officer_id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not reset PIN' };
  }
}

export async function persistStore(input: {
  id?: string | null;
  lguId: string;
  active?: boolean;
  willReorder?: boolean | null;
  patch: Record<string, unknown>;
}): Promise<{ error: string | null; store?: Store }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in' };

  if (!input.lguId) return { error: 'Choose an LGU' };

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Server admin key is missing' };
  }

  const row = {
    ...input.patch,
    lgu_id: input.lguId,
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(input.willReorder !== undefined ? { will_reorder: input.willReorder } : {}),
  };

  if (!input.id) {
    const { data, error } = await admin.from('stores').insert(row).select('*').single<Store>();
    if (error || !data) return { error: error?.message || 'Could not add store' };
    return { error: null, store: data };
  }

  const { data, error } = await admin.from('stores').update(row).eq('id', input.id).select('*').single<Store>();
  if (error || !data) return { error: error?.message || 'Could not save store' };
  return { error: null, store: data };
}

export async function removeStore(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in' };
  if (!id) return { error: 'Missing store' };

  try {
    const admin = createAdminClient();
    const { error } = await admin.from('stores').delete().eq('id', id);
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not delete store' };
  }
}

async function loadUsage(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<AccountUsage> {
  const [collections, payments, storeFeedback, appFeedback] = await Promise.all([
    supabase.from('collections').select('id', { count: 'exact', head: true }).eq('logged_by', userId),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('logged_by', userId),
    supabase.from('store_feedback').select('id', { count: 'exact', head: true }).eq('logged_by', userId),
    supabase.from('app_feedback').select('id', { count: 'exact', head: true }).eq('logged_by', userId),
  ]);
  return {
    collections: collections.count ?? 0,
    payments: payments.count ?? 0,
    storeFeedback: storeFeedback.count ?? 0,
    appFeedback: appFeedback.count ?? 0,
  };
}

export async function getAccountUsage(userId: string): Promise<{ error: string | null; usage?: AccountUsage }> {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { error: gate.error };
  return { error: null, usage: await loadUsage(gate.supabase, userId) };
}

export async function deleteAccount(userId: string): Promise<{ error: string | null }> {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { error: gate.error };
  if (userId === gate.user.id) return { error: 'You cannot delete your own login' };

  const usage = await loadUsage(gate.supabase, userId);
  if (usageTotal(usage) > 0) {
    return { error: `Cannot delete this login. It still has ${usageLines(usage).join(', ')}. Remove those rows in Database first.` };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not delete login' };
  }
}
