import * as React from 'react';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function useIsDesktop() {
  const q = '(min-width: 1024px)';
  return React.useSyncExternalStore(
    (cb) => { const m = window.matchMedia(q); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => window.matchMedia(q).matches,
  );
}
/** Bottom sheet on phones (drag down to dismiss); side panel on desktop. */
export function Sheet({ open, onOpenChange, title, children, footer }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const desktop = useIsDesktop();
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction={desktop ? 'right' : 'bottom'} repositionInputs modal={!desktop}>
      <Drawer.Portal>
        {!desktop && <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />}
        <Drawer.Content aria-describedby={undefined} className={cn('fixed z-50 flex flex-col bg-paper outline-none', desktop ? 'inset-y-0 right-0 w-[480px] shadow-lift' : 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl')}>
          {!desktop && <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line" />}
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
            <Drawer.Title className="font-display text-[22px] font-semibold">{title}</Drawer.Title>
            <Drawer.Close aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-sand"><X className="h-5 w-5" /></Drawer.Close>
          </div>
          <div data-vaul-no-drag className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
          {footer && <div className="border-t border-line bg-paper px-5 pb-safe pt-3"><div className="pb-3">{footer}</div></div>}
          {!footer && <div className="pb-safe" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
