'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Payment } from '@/lib/types';
import type { LiveStatus } from './useCollections';
import { listenTable } from './realtime';

export function usePayments(initial: Payment[]) {
  const [rows, setRows] = useState<Payment[]>(initial);
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const supabase = useRef(createClient());

  useEffect(() => {
    const sb = supabase.current;
    let active = true;

    const sortDesc = (a: Payment, b: Payment) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    const refresh = async () => {
      const { data } = await sb
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (active && data) setRows((data as Payment[]).slice().sort(sortDesc));
    };

    const channel = listenTable(sb, 'payments', (payload) => {
      if (!active) return;
      setRows((prev) => {
        let next = prev;
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as unknown as Payment;
          next = [row, ...prev.filter((r) => r.id !== row.id)];
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as { id: string };
          next = prev.filter((r) => r.id !== old.id);
        }
        return next.slice().sort(sortDesc);
      });
    });
    if (initial.length) {
      setStatus('live');
    } else {
      void refresh().then(() => {
        if (active) setStatus('live');
      });
    }

    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, []);

  return { rows, status, setRows };
}
