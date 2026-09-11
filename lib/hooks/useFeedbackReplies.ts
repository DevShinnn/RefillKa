'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { FeedbackReply } from '@/lib/types';
import { listenTable } from './realtime';

export function useFeedbackReplies(initial: FeedbackReply[] = [], enabled = true) {
  const [rows, setRows] = useState<FeedbackReply[]>(initial);
  const supabase = useRef(createClient());

  useEffect(() => {
    if (!enabled) return;
    const sb = supabase.current;
    let active = true;

    const sortAsc = (a: FeedbackReply, b: FeedbackReply) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

    const apply = (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
      if (!active) return;
      setRows((prev) => {
        let next = prev;
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as unknown as FeedbackReply;
          next = [...prev.filter((r) => r.id !== row.id), row];
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as { id: string };
          next = prev.filter((r) => r.id !== old.id);
        }
        return next.slice().sort(sortAsc);
      });
    };

    if (!initial.length) {
      void sb
        .from('feedback_replies')
        .select('*')
        .order('created_at')
        .limit(1000)
        .then(({ data }) => {
          if (active && data) setRows((data as FeedbackReply[]).slice().sort(sortAsc));
        });
    }

    const channel = listenTable(sb, 'feedback_replies', apply);
    return () => {
      active = false;
      void sb.removeChannel(channel);
    };
  }, [enabled]);

  return { rows, setRows };
}

export function repliesFor(
  rows: FeedbackReply[],
  kind: 'store' | 'app',
  parentId: string
) {
  return rows.filter((r) => (kind === 'store' ? r.store_feedback_id === parentId : r.app_feedback_id === parentId));
}
