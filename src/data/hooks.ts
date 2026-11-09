import { useCallback, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CancelledError, friendlyError, loadBundle, loadEvents, signedUrl } from './api';
import { syncQueue } from '@/offline/queue';
import type { EventBundle } from '@/domain/types';

export const keys = { bundle: (id: string) => ['bundle', id], events: ['events'] as const };
export const useBundle = (id: string) => useQuery({ queryKey: keys.bundle(id), queryFn: () => loadBundle(id), staleTime: 15_000, enabled: !!id });
export const useEvents = () => useQuery({ queryKey: keys.events, queryFn: loadEvents, staleTime: 30_000 });
export const useSignedUrl = (path?: string | null) => useQuery({ queryKey: ['signed', path], queryFn: () => signedUrl(path!), enabled: !!path && navigator.onLine, staleTime: 45 * 60_000, retry: 1 });
export const useSyncState = () => useSyncExternalStore(syncQueue.subscribe, syncQueue.get);

/** Wraps a change: runs it, refreshes the event, reports failure in plain language. */
export function useRun(eventId?: string) {
  const qc = useQueryClient();
  return useCallback(async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
    try {
      const r = await fn();
      if (eventId) await qc.invalidateQueries({ queryKey: keys.bundle(eventId) });
      await qc.invalidateQueries({ queryKey: keys.events });
      if (success) toast.success(success);
      return r ?? (true as T);
    } catch (e) {
      if (e instanceof CancelledError) { if (eventId) await qc.invalidateQueries({ queryKey: keys.bundle(eventId) }); return undefined; }
      toast.error(friendlyError(e));
      return undefined;
    }
  }, [eventId, qc]);
}
export function useTogglePacked(eventId: string) {
  const qc = useQueryClient();
  return (itemId: string, isPacked: boolean) => {
    qc.setQueryData<EventBundle>(keys.bundle(eventId), (b) => b && ({ ...b, packing: b.packing.map((p) => (p.id === itemId ? { ...p, is_packed: isPacked } : p)) }));
    void syncQueue.tick({ itemId, eventId, isPacked });
  };
}
