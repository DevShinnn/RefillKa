'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loginToEmail, normalizeOfficerId } from '@/lib/loginId';
import { ASSIGNABLE_ROLES, roleNeedsLgu, roleNeedsRegion, type Role } from '@/lib/roles';
import type { Profile } from '@/lib/types';
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

  const { data: taken } = await gate.supabase
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
  if (error || !data.user) return { error: error?.message || 'Could not create login' };

  const { data: account, error: loadErr } = await gate.supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single<Profile>();
  if (loadErr || !account) {
    return { error: loadErr?.message || 'Login created, but the profile did not appear. Refresh and check Database.' };
  }
  return { error: null, account };
}

export async function updateAccount(
  userId: string,
  input: AccountInput
): Promise<{ error: string | null; account?: Profile }> {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { error: gate.error };

  const checked = validateAccount(input);
  if (!checked.ok) return { error: checked.error };
  if (userId === gate.user.id && input.role !== 'superadmin') {
    return { error: 'You cannot remove your own superadmin role' };
  }

  const scope = scopeFor(input.role, input.lguId, input.regionId);
  const { data: account, error } = await gate.supabase
    .from('profiles')
    .update({
      officer_id: checked.officerId,
      full_name: checked.fullName,
      role: input.role,
      lgu_id: scope.lgu_id,
      region_id: scope.region_id,
    })
    .eq('id', userId)
    .select('*')
    .single<Profile>();
  if (error || !account) return { error: error?.message || 'Could not update account' };

  try {
    const admin = createAdminClient();
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
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not sync login email' };
  }

  return { error: null, account };
}

export async function resetPin(userId: string, pin: string): Promise<{ error: string | null }> {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { error: gate.error };
  if (!/^\d{6}$/.test(pin.trim())) return { error: 'PIN must be 6 digits' };

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { password: pin.trim() });
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not reset PIN' };
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
