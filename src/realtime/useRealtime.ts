import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { keys } from '@/data/hooks';
import type { NotificationRow } from '@/domain/types';

// Every change to an event writes one activity_log row (by trigger), so one subscription
// covers inserts, updates and deletes across all modules, and it honours RLS.
export function useEventRealtime(eventId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    let joined = false;
    const refresh = () => { clearTimeout(t); t = setTimeout(() => qc.invalidateQueries({ queryKey: keys.bundle(eventId) }), 250); };
    const ch = supabase.channel(`event:${eventId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `event_id=eq.${eventId}` }, refresh)
      .subscribe((s) => { if (s === 'SUBSCRIBED') { if (joined) refresh(); joined = true; } });
    return () => { clearTimeout(t); void supabase.removeChannel(ch); };
  }, [eventId, qc]);
}
export function useNotificationsRealtime(userId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (p) => {
        const n = p.new as NotificationRow;
        toast(n.title, { description: n.body ?? undefined });
        void qc.invalidateQueries({ queryKey: ['notifications', userId] });
        void qc.invalidateQueries({ queryKey: keys.events });
      }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userId, qc]);
}
