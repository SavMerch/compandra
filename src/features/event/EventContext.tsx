import * as React from 'react';
import { useBundle, useRun } from '@/data/hooks';
import { useAuth } from '@/auth/AuthProvider';
import { eventState, nowInZone } from '@/domain/time';
import { brand } from '@/config/brand';
import type { EventBundle, ItineraryItem } from '@/domain/types';

export type Mode = 'plan' | 'go';
export interface EventCtx {
  b: EventBundle & { fromCache?: boolean }; canEdit: boolean; state: ReturnType<typeof eventState>; today: string; nowTime: string; mode: Mode; setMode: (m: Mode) => void;
  run: ReturnType<typeof useRun>; personName: (uid?: string | null) => string; people: { id: string; name: string }[]; peopleOf: (itemId: string) => string[]; userId: string;
  openItem: (id: string) => void; addActivity: (d?: Partial<ItineraryItem>) => void; editItem: (i: ItineraryItem) => void; quickAdd: () => void; openMore: () => void;
}
const Ctx = React.createContext<EventCtx>(null as unknown as EventCtx);
export const useEvent = () => React.useContext(Ctx);
export { Ctx as EventCtxProvider };

export const modeKey = (id: string) => `${brand.storagePrefix}-mode-${id}`;
export function useEventBase(id: string) {
  const q = useBundle(id);
  const run = useRun(id);
  const { userId } = useAuth();
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);
  const [mode, setModeS] = React.useState<Mode>(() => { try { return (localStorage.getItem(modeKey(id)) as Mode) || 'plan'; } catch { return 'plan'; } });
  const setMode = (m: Mode) => { setModeS(m); try { localStorage.setItem(modeKey(id), m); } catch { /* preference only */ } };
  const derived = React.useMemo(() => {
    if (!q.data) return null;
    const b = q.data;
    const n = nowInZone(b.event.timezone);
    return {
      state: eventState(b.event), today: n.date, nowTime: n.time, canEdit: b.myRole === 'owner' || b.myRole === 'editor',
      personName: (uid?: string | null) => (uid === userId ? 'You' : b.profiles.find((p) => p.id === uid)?.display_name || b.participants.find((p) => p.user_id === uid)?.display_name || 'Someone'),
      people: b.participants.map((p) => ({ id: p.id, name: p.display_name })),
      peopleOf: (itemId: string) => b.itemPeople.filter((x) => x.item_id === itemId).map((x) => b.participants.find((p) => p.id === x.participant_id)?.display_name).filter(Boolean) as string[],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, tick, userId]);
  return { q, run, userId, mode, setMode, derived };
}
