import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

type Change = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

let seq = 0;

/** Unique channel so two hooks (or React Strict Mode) never reuse a subscribed topic. */
export function listenTable(
  sb: SupabaseClient,
  table: string,
  onChange: (payload: Change) => void,
  filter?: string
): RealtimeChannel {
  const name = `${table}:${++seq}:${Math.random().toString(36).slice(2, 8)}`;
  const channel = sb.channel(name);
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
    (payload) => onChange(payload as Change)
  );
  try {
    channel.subscribe();
  } catch {
    /* Realtime must never take down the page */
  }
  return channel;
}
