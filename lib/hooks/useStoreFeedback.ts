'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StoreFeedback } from '@/lib/types';

/**
 * Loads the timestamped feedback feed for a single store and keeps it live
 * via Supabase Realtime. Returns [] whenever no store is open.
 */
export function useStoreFeedback(storeId: string | null) {
  const [rows, setRows] = useState<StoreFeedback[]>([]);
  const supabase = useRef(createClient());

  useEffect(() => {
    if (!storeId) {
      setRows([]);
      return;
    }
    const sb = supabase.current;
    let active = true;

    const sortDesc = (a: StoreFeedback, b: StoreFeedback) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    const load = async () => {
      const { data } = await sb
        .from('store_feedback')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (active && data) setRows((data as StoreFeedback[]).slice().sort(sortDesc));
    };
    load();

    const channel = sb
      .channel(`store-feedback-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'store_feedback', filter: `store_id=eq.${storeId}` },
        (payload) => {
          if (!active) return;
          setRows((prev) => {
            let next = prev;
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const row = payload.new as StoreFeedback;
              next = [row, ...prev.filter((r) => r.id !== row.id)];
            } else if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              next = prev.filter((r) => r.id !== old.id);
            }
            return next.slice().sort(sortDesc);
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, [storeId]);

  return { rows, setRows };
}
