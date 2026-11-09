import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Camera, CalendarPlus, FileText, Hotel, ListChecks, LogOut, NotebookPen, Plane, Search as SearchIcon, Trophy, UserPlus, X, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Card, EmptyState, Field, Input, PageLoader, Select } from '@/components/ui/misc';
import { confirmDialog } from '@/components/ui/confirm';
import { useAuth } from '@/auth/AuthProvider';
import { friendlyError, deleteRow, loadWorkspaceMembers, rpc, safeName, updateRow } from '@/data/api';
import { keys } from '@/data/hooks';
import { addDays, timeAgo } from '@/domain/time';
import { authRedirectUrl } from '@/lib/platform';
import { supabase } from '@/lib/supabase';
import { cn, uuid } from '@/lib/utils';
import { authProviders } from '@/config/brand';
import type { NotificationRow } from '@/domain/types';
import { InviteSheet } from '../event/People';
import { CompanyLogo } from '@/components/CompanyLogo';

export function NotificationsPage() {
  const { userId } = useAuth(); const qc = useQueryClient(); const nav = useNavigate();
  const q = useQuery({ queryKey: ['notifications', userId], queryFn: async () => (await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(60)).data as NotificationRow[] });
  const inv = () => qc.invalidateQueries({ queryKey: ['notifications', userId] });
  if (q.isLoading) return <PageLoader />;
  const unread = q.data?.some((n) => !n.read_at);
  return <div className="pb-nav page-enter mx-auto max-w-2xl px-4 pt-safe lg:p-8"><div className="flex items-center justify-between py-4"><h1 className="font-display text-[30px] font-bold">Notifications</h1>{unread && <Button size="sm" variant="soft" onClick={async () => { await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null); await inv(); }}>Mark all read</Button>}</div>
    {!q.data?.length ? <EmptyState icon={Bell} title="You're all caught up" body="Schedule changes and tasks assigned to you show up here." /> : <ul className="space-y-2">{q.data.map((n) => <li key={n.id}><button onClick={async () => { if (!n.read_at) { await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id); await inv(); } if (n.link) nav(n.link); }} className={cn('flex min-h-16 w-full items-start gap-3 rounded-2xl p-3.5 text-left shadow-soft', n.read_at ? 'bg-card' : 'bg-teal-soft')}><span className="min-w-0 flex-1"><span className="block font-semibold">{n.title}</span>{n.body && <span className="block">{n.body}</span>}<span className="text-sm text-ink-soft">{timeAgo(n.created_at)}</span></span></button></li>)}</ul>}</div>;
}
const kindIcon: Record<string, typeof Plane> = { event: CalendarDays, activity: CalendarPlus, travel: Plane, stay: Hotel, competition: Trophy, document: FileText, task: ListChecks, note: NotebookPen };
const kindPath: Record<string, string> = { event: '', activity: '/agenda', travel: '/travel', stay: '/stay', competition: '/competition', document: '/documents', task: '/tasks', note: '/notes' };
export function SearchPage() {
  const [sp] = useSearchParams(); const eventId = sp.get('event'); const [term, setTerm] = React.useState(''); const [q, setQ] = React.useState('');
  React.useEffect(() => { const t = setTimeout(() => setQ(term.trim()), 250); return () => clearTimeout(t); }, [term]);
  const r = useQuery({ queryKey: ['search', q, eventId], enabled: q.length >= 2, queryFn: () => rpc<{ kind: string; id: string; event_id: string; title: string; subtitle: string | null }[]>('search_all', { p_query: q, p_event: eventId }) });
  return <div className="pb-nav page-enter mx-auto max-w-2xl px-4 pt-safe lg:p-8"><h1 className="py-4 font-display text-[30px] font-bold">{eventId ? 'Search this event' : 'Search'}</h1><div className="relative"><SearchIcon className="absolute left-3.5 top-3.5 h-5 w-5 text-ink-soft" aria-hidden /><Input autoFocus aria-label="Search" className="pl-11" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Hotel, confirmation number, task" /></div>
    {r.isError && <p className="mt-4 text-danger">{friendlyError(r.error)}</p>}{q.length >= 2 && r.data && !r.data.length && <EmptyState icon={SearchIcon} title="No matches" body={`Nothing found for "${q}".`} />}
    <ul className="mt-4 space-y-2">{r.data?.map((x) => { const I = kindIcon[x.kind] ?? FileText; return <li key={x.kind + x.id}><Link to={`/events/${x.event_id}${kindPath[x.kind] ?? ''}`} className="flex min-h-16 items-center gap-3 rounded-2xl bg-card p-3 shadow-soft"><I className="h-5 w-5 shrink-0 text-teal" aria-hidden /><span className="min-w-0"><span className="block truncate font-semibold">{x.title}</span>{x.subtitle && <span className="block truncate text-[15px] text-ink-soft">{x.subtitle}</span>}</span></Link></li>; })}</ul></div>;
}
const PROVIDER = { google: 'Google', apple: 'Apple', email: 'Email' } as Record<string, string>;
const PREFS = [{ k: 'schedule_changes', l: 'Schedule changes' }, { k: 'task_assigned', l: 'Tasks assigned to me' }, { k: 'comments', l: 'Comments' }];
function PasswordCard() {
  const [sp, setSp] = useSearchParams(); const resetting = sp.get('reset') === '1';
  const [pw, setPw] = React.useState(''); const [again, setAgain] = React.useState(''); const [busy, setBusy] = React.useState(false);
  return <section><h2 className="mb-2 font-display text-[21px] font-semibold">{resetting ? 'Choose a new password' : 'Password'}</h2><Card className="p-4"><form className="space-y-3" onSubmit={async (e) => {
    e.preventDefault();
    if (pw.length < 8) return void toast.error('Use at least 8 characters for your password.');
    if (pw !== again) return void toast.error('Those passwords do not match.');
    setBusy(true); const { error } = await supabase.auth.updateUser({ password: pw }); setBusy(false);
    if (error) toast.error(/different from the old/i.test(error.message) ? 'Choose a password different from your current one.' : friendlyError(error));
    else { toast.success('Password saved'); setPw(''); setAgain(''); if (resetting) setSp({}, { replace: true }); }
  }}><Field label="New password" htmlFor="np" hint="At least 8 characters."><Input id="np" type="password" required autoFocus={resetting} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field><Field label="Confirm new password" htmlFor="np2"><Input id="np2" type="password" required autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></Field><Button type="submit" variant="soft" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</Button></form></Card></section>;
}
function FamiliesCard() {
  const { workspaces, workspace, setWorkspace, refresh } = useAuth();
  const [name, setName] = React.useState(''); const [busy, setBusy] = React.useState(false);
  const labels: Record<string, string> = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer', guest: 'Invited to events' };
  return <section><h2 className="mb-2 font-display text-[21px] font-semibold">Your families</h2><Card className="divide-y divide-line">
    {workspaces.map((w) => <div key={w.workspace.id} className="flex min-h-16 items-center justify-between gap-3 px-4 py-2"><div className="min-w-0"><div className="truncate font-semibold">{w.workspace.name}</div><div className="text-[15px] text-ink-soft">{labels[w.role]}</div></div>{w.workspace.id === workspace?.id ? <Badge tone="teal">Selected</Badge> : <Button size="sm" variant="soft" aria-label={`Switch to ${w.workspace.name}`} onClick={() => setWorkspace(w.workspace.id)}>Switch</Button>}</div>)}
    <form className="flex items-end gap-2 p-4" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; setBusy(true); try { const id = await rpc<string>('create_workspace', { p_name: name.trim() }); await refresh(); setWorkspace(id); setName(''); toast.success('Family created'); } catch (x) { toast.error(friendlyError(x)); } finally { setBusy(false); } }}><div className="min-w-0 flex-1"><Field label="Create a new family" htmlFor="nf"><Input id="nf" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="The Rivera family" /></Field></div><Button type="submit" variant="soft" disabled={busy}>Create</Button></form>
  </Card></section>;
}
export function ProfilePage() {
  const { profile, userId, workspace, role, signOut, refresh, session } = useAuth();
  const qc = useQueryClient(); const nav = useNavigate();
  const [name, setName] = React.useState(''); const [invite, setInvite] = React.useState(false); const fileRef = React.useRef<HTMLInputElement>(null); const [sample, setSample] = React.useState('later');
  React.useEffect(() => { setName(profile?.display_name ?? ''); }, [profile?.display_name]);
  const ids = useQuery({ queryKey: ['identities', userId], queryFn: async () => (await supabase.auth.getUserIdentities()).data?.identities ?? [], enabled: !!session && navigator.onLine });
  const members = useQuery({ queryKey: ['ws-members', workspace?.id], enabled: !!workspace, queryFn: () => loadWorkspaceMembers(workspace!.id) });
  if (!profile) return <PageLoader />;
  const owner = role === 'owner';
  const setPref = async (k: string, v: boolean) => { const { error } = await supabase.from('profiles').update({ notification_prefs: { ...profile.notification_prefs, [k]: v } }).eq('id', userId); if (error) toast.error(friendlyError(error)); await refresh(); };
  const link = async (p: 'google' | 'apple') => { const { error } = await supabase.auth.linkIdentity({ provider: p, options: { redirectTo: authRedirectUrl() } }); if (error) toast.error(/manual linking/i.test(error.message) ? 'Account linking is not turned on in Supabase yet. See the setup guide.' : friendlyError(error)); };
  const refreshMembers = () => qc.invalidateQueries({ queryKey: ['ws-members', workspace?.id] });
  return <div className="pb-nav page-enter mx-auto max-w-2xl space-y-6 px-4 pt-safe lg:p-8"><h1 className="pt-4 font-display text-[30px] font-bold">Profile</h1>
    <Card className="space-y-4 p-4"><div className="flex items-center gap-4"><Avatar name={profile.display_name} src={profile.avatar_url} size={72} /><div className="min-w-0"><div className="truncate font-semibold">{profile.email}</div>
      <input ref={fileRef} hidden type="file" accept="image/*" aria-label="Choose photo" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (f.size > 5242880) return void toast.error('Choose a photo under 5 MB.'); const path = `${userId}/${uuid()}-${safeName(f.name)}`; const up = await supabase.storage.from('avatars').upload(path, f, { contentType: f.type }); if (up.error) return void toast.error(friendlyError(up.error)); const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl; await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId); await refresh(); toast.success('Photo updated'); }} />
      <Button size="sm" variant="soft" className="mt-1" onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4" />Change photo</Button></div></div>
      <form className="flex items-end gap-2" onSubmit={async (e) => { e.preventDefault(); const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', userId); if (error) toast.error(friendlyError(error)); else { toast.success('Name saved'); await refresh(); } }}><div className="flex-1"><Field label="Display name" htmlFor="dn"><Input id="dn" required value={name} onChange={(e) => setName(e.target.value)} /></Field></div><Button type="submit" variant="soft">Save</Button></form></Card>
    <PasswordCard />
    <section><h2 className="mb-2 font-display text-[21px] font-semibold">Sign-in methods</h2><Card className="divide-y divide-line">
      {ids.data?.map((i) => <div key={i.identity_id} className="flex min-h-14 items-center justify-between px-4"><span className="font-medium">{PROVIDER[i.provider] ?? i.provider}</span>{(ids.data?.length ?? 0) > 1 ? <Button size="sm" variant="dangerSoft" onClick={async () => { if (await confirmDialog({ title: `Disconnect ${PROVIDER[i.provider] ?? i.provider}?`, action: 'Disconnect', destructive: true })) { const { error } = await supabase.auth.unlinkIdentity(i); if (error) toast.error(friendlyError(error)); await ids.refetch(); } }}>Disconnect</Button> : <Badge tone="teal">Connected</Badge>}</div>)}
      {(['apple', 'google'] as const).filter((p) => authProviders[p] && !ids.data?.some((i) => i.provider === p)).map((p) => <div key={p} className="flex min-h-14 items-center justify-between px-4"><span className="font-medium">{PROVIDER[p]}</span><Button size="sm" variant="soft" onClick={() => link(p)}>Connect</Button></div>)}
    </Card></section>
    <FamiliesCard />
    {workspace && <section><div className="mb-2 flex items-center justify-between"><h2 className="font-display text-[21px] font-semibold">{workspace.name}</h2>{owner && <Button size="sm" onClick={() => setInvite(true)}><UserPlus className="h-4 w-4" />Invite</Button>}</div>
      <ul className="space-y-2">{members.data?.map((m) => <li key={m.id}><Card className="flex items-center gap-3 p-3"><Avatar name={m.profile?.display_name} src={m.profile?.avatar_url} /><span className="min-w-0 flex-1 truncate font-medium">{m.profile?.display_name || m.profile?.email}</span>
        {owner && m.user_id !== userId ? <><Select aria-label={`Role for ${m.profile?.display_name}`} className="w-28" value={m.role} onChange={async (e) => { try { await updateRow('workspace_members', m.id, { role: e.target.value }); toast.success('Role changed'); } catch (x) { toast.error(friendlyError(x)); } await refreshMembers(); }}><option value="owner">Owner</option><option value="editor">Editor</option><option value="viewer">Viewer</option>{m.role === 'guest' && <option value="guest">Guest</option>}</Select><Button size="icon" variant="ghost" aria-label={`Remove ${m.profile?.display_name}`} onClick={async () => { if (await confirmDialog({ title: `Remove ${m.profile?.display_name}?`, body: 'They lose access to family events.', action: 'Remove', destructive: true })) { try { await deleteRow('workspace_members', m.id); toast.success('Removed'); } catch (x) { toast.error(friendlyError(x)); } await refreshMembers(); } }}><X className="h-5 w-5" /></Button></> : <Badge className="capitalize">{m.role}</Badge>}</Card></li>)}</ul></section>}
    <section><h2 className="mb-1 font-display text-[21px] font-semibold">Notifications</h2><p className="mb-2 text-ink-soft">These appear inside the app. Phone push alerts and email aren't available yet.</p><Card className="divide-y divide-line">{PREFS.map((p) => <label key={p.k} className="flex min-h-14 items-center justify-between px-4 font-medium">{p.l}<input type="checkbox" className="h-6 w-6 accent-teal" checked={profile.notification_prefs?.[p.k] !== false} onChange={(e) => setPref(p.k, e.target.checked)} /></label>)}</Card></section>
    {workspace && (owner || role === 'editor') && <section><h2 className="mb-1 font-display text-[21px] font-semibold">Sample event</h2><p className="mb-2 text-ink-soft">Add a fictional competition weekend to see how everything connects. You can delete it later.</p><div className="flex gap-2"><Select aria-label="When the sample starts" value={sample} onChange={(e) => setSample(e.target.value)}><option value="later">Starts in two weeks</option><option value="now">Starting today (see Go Mode)</option></Select><Button variant="soft" onClick={async () => { try { const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; const id = await rpc<string>('create_sample_event', { p_workspace: workspace.id, p_start: sample === 'now' ? today : addDays(today, 14) }); await qc.invalidateQueries({ queryKey: keys.events }); nav(`/events/${id}`); } catch (e) { toast.error(friendlyError(e)); } }}>Add</Button></div></section>}
    <Button variant="outline" className="w-full" onClick={signOut}><LogOut className="h-5 w-5" />Sign out</Button>
    <CompanyLogo className="mx-auto" />
    {invite && workspace && <InviteSheet workspaceId={workspace.id} title={workspace.name} onClose={() => setInvite(false)} />}
  </div>;
}
