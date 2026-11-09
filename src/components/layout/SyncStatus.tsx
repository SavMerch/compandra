import * as React from 'react';
import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { useSyncState } from '@/data/hooks';
import { syncQueue } from '@/offline/queue';

export function useOnlineWatcher() {
  React.useEffect(() => {
    const on = () => syncQueue.setOnline(true), off = () => syncQueue.setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
}
export function SyncBanner() {
  const s = useSyncState();
  const ref = React.useRef<HTMLDivElement>(null);
  // Sticky event headers sit below the banner instead of under it.
  React.useLayoutEffect(() => { document.documentElement.style.setProperty('--banner-h', `${ref.current?.offsetHeight ?? 0}px`); });
  return <div ref={ref}><BannerBody s={s} /></div>;
}
function BannerBody({ s }: { s: ReturnType<typeof useSyncState> }) {
  if (s.failed) return <button onClick={() => syncQueue.clearFailed()} role="status" className="flex w-full items-center justify-center gap-2 bg-accent-soft px-4 py-2 pt-safe text-sm font-medium text-danger"><TriangleAlert className="h-4 w-4" />{s.failed} packing change{s.failed > 1 ? 's' : ''} couldn't be saved. Dismiss</button>;
  if (!s.online) return <div role="status" className="flex items-center justify-center gap-2 bg-ink px-4 py-2 pt-safe text-sm font-medium text-white"><CloudOff className="h-4 w-4" />Offline. Showing saved events{s.pending.length ? `, ${s.pending.length} change${s.pending.length > 1 ? 's' : ''} waiting` : ''}</div>;
  if (s.pending.length) return <div role="status" className="flex items-center justify-center gap-2 bg-teal-soft px-4 py-2 pt-safe text-sm font-medium text-teal"><RefreshCw className="h-4 w-4 animate-spin" />Syncing {s.pending.length} change{s.pending.length > 1 ? 's' : ''}</div>;
  return null;
}
