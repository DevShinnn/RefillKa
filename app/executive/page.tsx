import { Suspense } from 'react';
import { AppBoot } from '@/components/AppBoot';
import { ExecClient } from '@/components/ExecClient';
import { PageLoading } from '@/components/PageLoading';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { scopeLabel } from '@/lib/scope';
import type { Collection, Lgu, Payment, Product, Profile, Store } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function ExecutivePage() {
  return (
    <Suspense fallback={<PageLoading label="Opening executive…" />}>
      <ExecutiveGate />
    </Suspense>
  );
}

async function ExecutiveGate() {
  const { profile } = await requireProfile([
    'superadmin',
    'lgu_exec',
    'regional_exec',
    'national_exec',
    'national_admin',
  ]);
  return (
    <Suspense fallback={<AppBoot profile={profile} label="Loading executive summary…" />}>
      <ExecutiveData profile={profile} />
    </Suspense>
  );
}

async function ExecutiveData({ profile }: { profile: Profile }) {
  const supabase = await createClient();
  const [{ data: stores }, { data: products }, { data: collections }, { data: payments }, { data: lgus }, scope] = await Promise.all([
    supabase.from('stores').select('*').order('name'),
    supabase.from('products').select('*').eq('active', true).order('sort_order'),
    supabase.from('collections').select('*').order('created_at', { ascending: false }).limit(1000),
    supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(1000),
    supabase.from('lgus').select('*').order('name'),
    scopeLabel(supabase, profile),
  ]);

  return (
    <ExecClient
      profile={profile}
      scope={scope}
      stores={(stores as Store[]) ?? []}
      products={(products as Product[]) ?? []}
      payments={(payments as Payment[]) ?? []}
      initial={(collections as Collection[]) ?? []}
      lgus={(lgus as Lgu[]) ?? []}
    />
  );
}
