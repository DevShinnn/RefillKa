import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AppBoot } from '@/components/AppBoot';
import { LoginBox } from '@/components/LoginBox';
import { OpsConsole } from '@/components/OpsConsole';
import { PageLoading } from '@/components/PageLoading';
import { homeForRole, isFieldRole, type Role } from '@/lib/roles';
import { scopeLabel } from '@/lib/scope';
import { createClient } from '@/lib/supabase/server';
import type { AppFeedback, Collection, FeedbackReply, Lgu, Payment, Product, Profile, Region, Store, StoreFeedback } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function OpsPage() {
  return (
    <Suspense fallback={<PageLoading label="Opening operations…" />}>
      <OpsGate />
    </Suspense>
  );
}

async function OpsGate() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return <LoginBox portal="ops" />;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single<Profile>();

  if (!profile || isFieldRole(profile.role)) redirect('/log');
  if (profile.role !== 'superadmin') redirect(homeForRole(profile.role as Role));

  return (
    <Suspense fallback={<AppBoot profile={profile} label="Loading operations…" />}>
      <OpsData profile={profile} />
    </Suspense>
  );
}

async function OpsData({ profile }: { profile: Profile }) {
  const supabase = await createClient();
  const [
    { data: stores },
    { data: collections },
    { data: payments },
    { data: accounts },
    { data: products },
    { data: lgus },
    { data: regions },
    { data: storeNotes },
    { data: appNotes },
    { data: replies },
    scope,
  ] = await Promise.all([
    supabase.from('stores').select('*').order('name'),
    supabase.from('collections').select('*').order('created_at', { ascending: false }).limit(1000),
    supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(1000),
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('products').select('*').order('sort_order'),
    supabase.from('lgus').select('*').order('name'),
    supabase.from('regions').select('*').order('name'),
    supabase.from('store_feedback').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('app_feedback').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('feedback_replies').select('*').order('created_at').limit(1000),
    scopeLabel(supabase, profile),
  ]);

  return (
    <OpsConsole
      profile={profile}
      scope={scope}
      stores={(stores as Store[]) ?? []}
      payments={(payments as Payment[]) ?? []}
      orders={(collections as Collection[]) ?? []}
      accounts={(accounts as Profile[]) ?? []}
      products={(products as Product[]) ?? []}
      lgus={(lgus as Lgu[]) ?? []}
      regions={(regions as Region[]) ?? []}
      storeNotes={(storeNotes as StoreFeedback[]) ?? []}
      appNotes={(appNotes as AppFeedback[]) ?? []}
      replies={(replies as FeedbackReply[]) ?? []}
    />
  );
}
