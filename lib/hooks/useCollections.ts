'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Collection } from '@/lib/types';
import { listenTable } from './realtime';

export type LiveStatus = 'connecting' | 'live' | 'offline';

/**
 * Subscribes to the shared collections ledger and keeps it live via Supabase
 * Realtime. `initial` is the server-rendered snapshot (fast first paint).
 */
export function useCollections(initial: Collection[]) {
  const [rows, setRows] = useState<Collection[]>(initial);
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const supabase = useRef(createClient());

  useEffect(() => {
    const sb = supabase.current;
    let active = true;

    const sortDesc = (a: Collection, b: Collection) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    // Re-pull a fresh snapshot (used on (re)connect).
    const refresh = async () => {
      const { data } = await sb
        .from('collections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (active && data) setRows((data as Collection[]).slice().sort(sortDesc));
    };

    const channel = listenTable(sb, 'collections', (payload) => {
      if (!active) return;
      setRows((prev) => {
        let next = prev;
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as unknown as Collection;
          next = [row, ...prev.filter((r) => r.id !== row.id)];
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as { id: string };
          next = prev.filter((r) => r.id !== old.id);
        }
        return next.slice().sort(sortDesc);
      });
    });
    void refresh().then(() => {
      if (active) setStatus('live');
    });

    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, []);

  return { rows, status, setRows };
}
