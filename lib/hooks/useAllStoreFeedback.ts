'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StoreFeedback } from '@/lib/types';
import { listenTable } from './realtime';

export function useAllStoreFeedback(initial: StoreFeedback[] = []) {
  const [rows, setRows] = useState<StoreFeedback[]>(initial);
  const supabase = useRef(createClient());

  useEffect(() => {
    const sb = supabase.current;
    let active = true;

    const sortDesc = (a: StoreFeedback, b: StoreFeedback) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    if (!initial.length) {
      void sb
        .from('store_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
        .then(({ data }) => {
          if (active && data) setRows((data as StoreFeedback[]).slice().sort(sortDesc));
        });
    }

    const channel = listenTable(sb, 'store_feedback', (payload) => {
      if (!active) return;
      setRows((prev) => {
        let next = prev;
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as unknown as StoreFeedback;
          next = [row, ...prev.filter((r) => r.id !== row.id)];
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as { id: string };
          next = prev.filter((r) => r.id !== old.id);
        }
        return next.slice().sort(sortDesc);
      });
    });

    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, []);

  return { rows, setRows };
}
