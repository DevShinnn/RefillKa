import { requireProfile } from '@/lib/auth';
import { scopeLabel } from '@/lib/scope';
import type { Collection, Store } from '@/lib/types';
import { ExecClient } from '@/components/ExecClient';

export const dynamic = 'force-dynamic';

export default async function ExecutivePage() {
  const { supabase, profile } = await requireProfile([
    'superadmin',
    'lgu_exec',
    'regional_exec',
    'national_exec',
    'national_admin',
  ]);

  const [{ data: stores }, { data: collections }, scope] = await Promise.all([
    supabase.from('stores').select('*').order('name'),
    supabase.from('collections').select('*').order('created_at', { ascending: false }).limit(1000),
    scopeLabel(supabase, profile),
  ]);

  return (
    <ExecClient
      profile={profile}
      scope={scope}
      stores={(stores as Store[]) ?? []}
      initial={(collections as Collection[]) ?? []}
    />
  );
}
