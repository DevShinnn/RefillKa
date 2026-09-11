import { Suspense } from 'react';
import { AppBoot } from '@/components/AppBoot';
import { CrmClient } from '@/components/CrmClient';
import { PageLoading } from '@/components/PageLoading';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { scopeLabel } from '@/lib/scope';
import type { Collection, Lgu, Payment, Product, Profile, Store } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function LogPage() {
  return (
    <Suspense fallback={<PageLoading label="Opening field CRM…" />}>
      <LogGate />
    </Suspense>
  );
}

async function LogGate() {
  const { profile } = await requireProfile(['superadmin', 'cenro', 'lgu_admin', 'national_admin']);
  return (
    <Suspense fallback={<AppBoot profile={profile} label="Loading stores and collections…" />}>
      <LogData profile={profile} />
    </Suspense>
  );
}

async function LogData({ profile }: { profile: Profile }) {
  const supabase = await createClient();
  const [{ data: stores }, { data: products }, { data: collections }, { data: payments }, { data: lgus }, scope] = await Promise.all([
    supabase.from('stores').select('*').eq('active', true).order('name'),
    supabase.from('products').select('*').eq('active', true).order('sort_order'),
    supabase.from('collections').select('*').order('created_at', { ascending: false }).limit(1000),
    supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(1000),
    supabase.from('lgus').select('*').order('name'),
    scopeLabel(supabase, profile),
  ]);

  return (
    <CrmClient
      profile={profile}
      scope={scope}
      stores={(stores as Store[]) ?? []}
      products={(products as Product[]) ?? []}
      orders={(collections as Collection[]) ?? []}
      payments={(payments as Payment[]) ?? []}
      lgus={(lgus as Lgu[]) ?? []}
    />
  );
}
