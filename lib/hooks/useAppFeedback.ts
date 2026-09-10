'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AppFeedback } from '@/lib/types';

export function useAppFeedback(initial: AppFeedback[] = []) {
  const [rows, setRows] = useState<AppFeedback[]>(initial);
  const supabase = useRef(createClient());

  useEffect(() => {
    const sb = supabase.current;
    let active = true;

    const sortDesc = (a: AppFeedback, b: AppFeedback) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    const load = async () => {
      const { data } = await sb.from('app_feedback').select('*').order('created_at', { ascending: false }).limit(200);
      if (active && data) setRows((data as AppFeedback[]).slice().sort(sortDesc));
    };
    load();

    const channel = sb
      .channel('app-feedback')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_feedback' }, (payload) => {
        if (!active) return;
        setRows((prev) => {
          let next = prev;
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as AppFeedback;
            next = [row, ...prev.filter((r) => r.id !== row.id)];
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string };
            next = prev.filter((r) => r.id !== old.id);
          }
          return next.slice().sort(sortDesc);
        });
      })
      .subscribe();

    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, []);

  return { rows, setRows };
}
