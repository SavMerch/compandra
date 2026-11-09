import * as React from 'react';
import * as AD from '@radix-ui/react-alert-dialog';
import { Button } from './button';

interface Opts { title: string; body?: string; action: string; cancel?: string; destructive?: boolean; }
let opener: ((o: Opts) => Promise<boolean>) | null = null;
/** Promise-based confirmation usable from data code (e.g. conflict resolution). */
export const confirmDialog = (o: Opts) => opener?.(o) ?? Promise.resolve(false);

export function ConfirmHost() {
  const [s, set] = React.useState<(Opts & { resolve: (v: boolean) => void }) | null>(null);
  React.useEffect(() => { opener = (o) => new Promise((resolve) => set({ ...o, resolve })); return () => { opener = null; }; }, []);
  const done = (v: boolean) => { s?.resolve(v); set(null); };
  return (
    <AD.Root open={!!s} onOpenChange={(o) => !o && done(false)}>
      <AD.Portal>
        <AD.Overlay className="fixed inset-0 z-[60] bg-ink/45" />
        <AD.Content className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-6 shadow-lift">
          <AD.Title className="font-display text-xl font-semibold">{s?.title}</AD.Title>
          {s?.body ? <AD.Description className="mt-2 text-ink-soft">{s.body}</AD.Description> : <AD.Description className="sr-only">Confirm this action</AD.Description>}
          <div className="mt-5 flex flex-col gap-2">
            <AD.Action asChild><Button variant={s?.destructive ? 'danger' : 'primary'} onClick={() => done(true)}>{s?.action}</Button></AD.Action>
            <AD.Cancel asChild><Button variant="soft" onClick={() => done(false)}>{s?.cancel ?? 'Cancel'}</Button></AD.Cancel>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
