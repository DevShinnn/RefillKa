import { requireProfile } from '@/lib/auth';
import { scopeLabel } from '@/lib/scope';
import type { Collection, Payment, Product, Store } from '@/lib/types';
import { CrmClient } from '@/components/CrmClient';

export const dynamic = 'force-dynamic';

export default async function LogPage() {
  const { supabase, profile } = await requireProfile(['superadmin', 'cenro', 'lgu_admin', 'national_admin']);

  const [{ data: stores }, { data: products }, { data: collections }, { data: payments }, scope] = await Promise.all([
    supabase.from('stores').select('*').eq('active', true).order('name'),
    supabase.from('products').select('*').eq('active', true).order('sort_order'),
    supabase.from('collections').select('*').order('created_at', { ascending: false }).limit(1000),
    supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(1000),
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
    />
  );
}
