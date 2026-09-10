import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types';

/**
 * Human-readable scope label for a profile — e.g. "National", "NCR region",
 * or "Taguig City". Shown in the top bar so users see the data boundary
 * they're operating within.
 */
export async function scopeLabel(supabase: SupabaseClient, profile: Profile): Promise<string> {
  if (profile.role === 'superadmin') return 'Developer · all LGUs';
  if (profile.role === 'national_admin' || profile.role === 'national_exec') return 'National';

  if (profile.role === 'regional_exec' && profile.region_id) {
    const { data } = await supabase.from('regions').select('code,name').eq('id', profile.region_id).single();
    return data ? `${data.code} region` : 'Region';
  }

  if (profile.lgu_id) {
    const { data } = await supabase.from('lgus').select('name,kind').eq('id', profile.lgu_id).single();
    return data ? `${data.name} ${data.kind}` : 'LGU';
  }

  return '—';
}
