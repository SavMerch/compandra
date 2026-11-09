import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, Share2, Trash2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Avatar, Badge, Card, Field, Input, Select } from '@/components/ui/misc';
import { confirmDialog } from '@/components/ui/confirm';
import { useAuth } from '@/auth/AuthProvider';
import { deleteRow, friendlyError, insertRow, loadWorkspaceMembers, rpc, updateRow } from '@/data/api';
import { copyText, shareLink } from '@/lib/platform';
import { supabase } from '@/lib/supabase';
import { brand } from '@/config/brand';
import type { Invitation } from '@/domain/types';
import { useEvent } from './EventContext';

export function InviteSheet({ workspaceId, eventId, title, onClose, onCreated }: { workspaceId: string; eventId?: string; title: string; onClose: () => void; onCreated?: () => void }) {
  const [email, setEmail] = React.useState(''); const [role, setRole] = React.useState('editor'); const [busy, setBusy] = React.useState(false); const [link, setLink] = React.useState('');
  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { const token = await rpc<string>('create_invitation', { p_workspace: workspaceId, p_email: email, p_role: role, p_event: eventId ?? null }); setLink(`${window.location.origin}/invite/${token}`); onCreated?.(); }
    catch (err) { toast.error(friendlyError(err)); } finally { setBusy(false); }
  };
  const msg = `Join me on ${brand.plainName} to plan ${title}.`;
  return <Sheet open onOpenChange={(o) => !o && onClose()} title="Invite someone">
    {link ? <div className="space-y-3 pb-3"><p>Your invitation is ready. Send this link to {email}. It works once and expires in 14 days.</p>
      <Input readOnly aria-label="Invitation link" value={link} onFocus={(e) => e.target.select()} />
      <Button size="lg" className="w-full" onClick={async () => { if (!(await shareLink({ title: brand.name, text: msg, url: link }))) { await copyText(link); toast.success('Link copied'); } }}><Share2 className="h-5 w-5" />Share link</Button>
      <Button asChild variant="soft" className="w-full"><a href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Join ${title} on ${brand.plainName}`)}&body=${encodeURIComponent(`${msg}\n\n${link}`)}`}><Mail className="h-5 w-5" />Open in email</a></Button>
      <Button variant="ghost" className="w-full" onClick={async () => { await copyText(link); toast.success('Link copied'); }}>Copy link</Button></div>
    : <form onSubmit={create} className="space-y-4 pb-3"><Field label="Their email" htmlFor="ie"><Input id="ie" type="email" required autoCapitalize="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></Field>
      <Field label="What can they do?" htmlFor="ir"><Select id="ir" value={role} onChange={(e) => setRole(e.target.value)}><option value="editor">Edit plans</option><option value="viewer">View, check off packing, and complete their tasks</option></Select></Field>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Creating…' : 'Create invitation'}</Button></form>}
  </Sheet>;
}
export function ParticipantsPage() {
  const { b, canEdit, run, userId } = useEvent();
  const { role: wsRole } = useAuth();
  const qc = useQueryClient();
  const [invite, setInvite] = React.useState(false); const [guest, setGuest] = React.useState(''); const [isChild, setIsChild] = React.useState(false); const [addOpen, setAddOpen] = React.useState(false);
  const wm = useQuery({ queryKey: ['ws-members', b.event.workspace_id], queryFn: () => loadWorkspaceMembers(b.event.workspace_id), enabled: canEdit });
  const invs = useQuery({ queryKey: ['invites', b.event.id], enabled: canEdit, queryFn: async () => (await supabase.from('workspace_invitations').select('*').eq('event_id', b.event.id).is('accepted_at', null).is('revoked_at', null).gt('expires_at', new Date().toISOString())).data as Invitation[] });
  const notIn = (wm.data ?? []).filter((m) => !b.members.some((x) => x.user_id === m.user_id));
  const memberOf = (uid: string | null) => b.members.find((m) => m.user_id === uid);
  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 lg:p-6">
      <div className="flex items-center justify-between"><h2 className="font-display text-[26px] font-bold">People</h2>{canEdit && <Button onClick={() => setInvite(true)}><UserPlus className="h-5 w-5" />Invite</Button>}</div>
      <ul className="space-y-2">{b.participants.map((p) => {
        const m = memberOf(p.user_id);
        const avatar = b.profiles.find((x) => x.id === p.user_id)?.avatar_url;
        return <li key={p.id}><Card className="flex min-h-16 items-center gap-3 p-3"><Avatar name={p.display_name} src={avatar} size={42} /><div className="min-w-0 flex-1"><div className="truncate font-semibold">{p.display_name}{p.user_id === userId ? ' (you)' : ''}</div><div className="text-[15px] text-ink-soft">{p.user_id ? (m?.role === 'viewer' ? 'Can view' : 'Can edit') : p.is_child ? 'Child, no account' : 'No account'}</div></div>
          {canEdit && m && p.user_id !== userId && <Select aria-label={`Access for ${p.display_name}`} className="w-28 shrink-0" value={m.role} onChange={(e) => run(() => updateRow('event_members', m.id, { role: e.target.value }).then(() => true), 'Access changed')}><option value="editor">Edit</option><option value="viewer">View</option></Select>}
          {canEdit && p.user_id !== userId && <Button size="icon" variant="ghost" aria-label={`Remove ${p.display_name}`} onClick={async () => { if (await confirmDialog({ title: `Remove ${p.display_name} from this event?`, body: p.user_id && b.event.visibility === 'private' ? 'They will lose access.' : undefined, action: 'Remove', destructive: true })) await run(async () => { if (m) await deleteRow('event_members', m.id); await deleteRow('event_participants', p.id); return true; }, 'Removed'); }}><X className="h-5 w-5" /></Button>}
        </Card></li>;
      })}</ul>
      {canEdit && <Button variant="soft" className="w-full" onClick={() => setAddOpen(true)}><Plus className="h-5 w-5" />Add someone without an account</Button>}
      {canEdit && notIn.length > 0 && <section><h3 className="mb-2 font-display text-lg font-semibold">From your family</h3><ul className="space-y-2">{notIn.filter((m) => m.role !== 'guest').map((m) => <li key={m.id}><Card className="flex items-center gap-3 p-3"><Avatar name={m.profile?.display_name} src={m.profile?.avatar_url} /><span className="min-w-0 flex-1 truncate font-medium">{m.profile?.display_name}</span><Button size="sm" variant="soft" onClick={() => run(() => insertRow('event_members', { event_id: b.event.id, user_id: m.user_id, role: m.role === 'viewer' ? 'viewer' : 'editor' }), 'Added')}>Add</Button></Card></li>)}</ul></section>}
      {canEdit && !!invs.data?.length && <section><h3 className="mb-2 font-display text-lg font-semibold">Pending invitations</h3><ul className="space-y-2">{invs.data.map((i) => <li key={i.id}><Card className="flex items-center gap-3 p-3"><span className="min-w-0 flex-1 truncate">{i.email}</span><Badge className="capitalize">{i.role}</Badge><Button size="sm" variant="dangerSoft" onClick={async () => { await run(() => updateRow('workspace_invitations', i.id, { revoked_at: new Date().toISOString() }).then(() => true), 'Invitation cancelled'); void qc.invalidateQueries({ queryKey: ['invites', b.event.id] }); }}><Trash2 className="h-4 w-4" />Cancel</Button></Card></li>)}</ul></section>}
      {invite && <InviteSheet workspaceId={b.event.workspace_id} eventId={b.event.id} title={b.event.title} onClose={() => setInvite(false)} onCreated={() => qc.invalidateQueries({ queryKey: ['invites', b.event.id] })} />}
      {addOpen && <Sheet open onOpenChange={setAddOpen} title="Add a person"><form className="space-y-4 pb-3" onSubmit={async (e) => { e.preventDefault(); if (!guest.trim()) return; const ok = await run(() => insertRow('event_participants', { event_id: b.event.id, display_name: guest.trim(), is_child: isChild }), 'Added'); if (ok) { setGuest(''); setIsChild(false); setAddOpen(false); } }}><Field label="Name" htmlFor="gn"><Input id="gn" required value={guest} onChange={(e) => setGuest(e.target.value)} /></Field><label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-6 w-6 accent-teal" checked={isChild} onChange={(e) => setIsChild(e.target.checked)} />This is a child</label><Button type="submit" size="lg" className="w-full">Add person</Button></form></Sheet>}
      {wsRole === 'owner' && <p className="text-sm text-ink-soft">Manage the whole family in Profile.</p>}
    </div>
  );
}
