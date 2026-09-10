import { Suspense } from 'react';
import { requireProfile } from '@/lib/auth';
import { scopeLabel } from '@/lib/scope';
import type { Collection, Payment, Product, Store } from '@/lib/types';
import { AdminClient } from '@/components/AdminClient';
import AdminLoading from './loading';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminApp />
    </Suspense>
  );
}

async function AdminApp() {
  const { supabase, profile } = await requireProfile(['superadmin', 'lgu_admin', 'national_admin']);

  const [{ data: stores }, { data: products }, { data: collections }, { data: payments }, scope] = await Promise.all([
    supabase.from('stores').select('*').order('name'),
    supabase.from('products').select('*').eq('active', true).order('sort_order'),
    supabase.from('collections').select('*').order('created_at', { ascending: false }).limit(1000),
    supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(1000),
    scopeLabel(supabase, profile),
  ]);

  return (
    <AdminClient
      profile={profile}
      scope={scope}
      stores={(stores as Store[]) ?? []}
      products={(products as Product[]) ?? []}
      payments={(payments as Payment[]) ?? []}
      initial={(collections as Collection[]) ?? []}
    />
  );
}
