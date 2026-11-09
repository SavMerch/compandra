import * as React from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { loadWorkspaces } from '@/data/api';
import { secureStore } from '@/offline/secureStore';
import { syncQueue } from '@/offline/queue';
import { brand } from '@/config/brand';
import type { Profile, Role, Workspace } from '@/domain/types';

interface Ctx {
  session: Session | null; loading: boolean; userId: string; profile: Profile | null; workspace: Workspace | null; role: Role | null;
  workspaces: { workspace: Workspace; role: Role }[]; setWorkspace: (id: string) => void; familyFilter: string | null; setFamilyFilter: (id: string | null) => void;
  workspacesLoading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void>;
}
const AuthCtx = React.createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => React.useContext(AuthCtx);
const lastUserKey = `${brand.storagePrefix}-last-user`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);
  const qc = useQueryClient();

  React.useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setLoading(false); });
    return () => data.subscription.unsubscribe();
  }, []);
  const userId = session?.user.id ?? '';
  React.useEffect(() => {
    if (!userId) return;
    // A different person on this device must never see the previous user's cache.
    const last = localStorage.getItem(lastUserKey);
    (async () => {
      if (last && last !== userId) { await secureStore.wipe(); syncQueue.reset(); qc.clear(); }
      localStorage.setItem(lastUserKey, userId);
      await syncQueue.load();
    })();
  }, [userId, qc]);

  const profileQ = useQuery({ queryKey: ['profile', userId], enabled: !!userId, queryFn: async () => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error; return data as Profile | null;
  } });
  const wsQ = useQuery({ queryKey: ['workspaces', userId], enabled: !!userId, queryFn: () => loadWorkspaces(userId) });

  // Active family: the last one chosen on this device, otherwise the first the person belongs to fully.
  const activeKey = `${brand.storagePrefix}-family-${userId}`;
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [familyFilter, setFilterState] = React.useState<string | null>(null);
  React.useEffect(() => { if (!userId) return; setFilterState(null); try { setActiveId(localStorage.getItem(`${brand.storagePrefix}-family-${userId}`)); } catch { /* preference only */ } }, [userId]);
  const setWorkspace = (id: string) => { setActiveId(id); try { localStorage.setItem(activeKey, id); } catch { /* preference only */ } };
  const setFamilyFilter = (id: string | null) => { setFilterState(id); if (id) setWorkspace(id); };
  const rows = wsQ.data ?? [];
  const active = rows.find((r) => r.workspace.id === activeId) ?? rows.find((r) => r.role !== 'guest') ?? rows[0];

  const value: Ctx = {
    session, loading, userId, profile: profileQ.data ?? null, workspace: active?.workspace ?? null, role: active?.role ?? null,
    workspaces: rows, setWorkspace, familyFilter, setFamilyFilter,
    workspacesLoading: !!userId && wsQ.isLoading,
    refresh: async () => { await qc.invalidateQueries({ queryKey: ['profile', userId] }); await qc.invalidateQueries({ queryKey: ['workspaces', userId] }); },
    signOut: async () => {
      await supabase.auth.signOut();
      await secureStore.wipe(); syncQueue.reset(); qc.clear(); localStorage.removeItem(lastUserKey);
    },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
