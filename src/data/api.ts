import { supabase } from '@/lib/supabase';
import { confirmDialog } from '@/components/ui/confirm';
import { secureStore } from '@/offline/secureStore';
import { overlayPending } from '@/offline/queue';
import { uuid } from '@/lib/utils';
import type { EventBundle, EventRow, EventRole, WorkspaceMember, Workspace, Profile } from '@/domain/types';

export class CancelledError extends Error {}
export const isNetworkError = (e: unknown) => !navigator.onLine || /failed to fetch|network|load failed/i.test((e as Error)?.message ?? '');
export function friendlyError(e: unknown) {
  const m = (e as { message?: string })?.message ?? '';
  if (isNetworkError(e)) return "You're offline. Reconnect and try again. Packing checkmarks still save offline.";
  if (/row-level security|permission/i.test(m)) return m.startsWith('You do not') ? m : "You don't have permission to make this change. Ask an owner or editor.";
     if (/rate limit|too many requests|security purposes/i.test(m)) return 'Too many sign-in emails were sent recently. Wait a while and try again, or sign in with your password.';
   if (/too large|maximum allowed size/i.test(m)) return 'That file is too large. The limit is 25 MB.';
  return m || 'That did not save. Try again.';
}
function must<T>(r: { data: T | null; error: unknown }): T { if (r.error) throw r.error; return r.data as T; }
const byEvent = (t: string, id: string, sel = '*') => supabase.from(t).select(sel).eq('event_id', id);

export async function fetchBundle(id: string): Promise<EventBundle> {
  const event = must(await supabase.from('events').select('*').eq('id', id).single()) as unknown as EventRow;
  const [days, items, itemPeople, participants, members, wm, travel, travelers, stays, guests, sessions, sessionPeople, lists, packing, tasks, notes, documents, comments, activity, role] = await Promise.all([
    byEvent('event_days', id).order('day_date'), byEvent('itinerary_items', id).order('position'), byEvent('activity_participants', id),
    byEvent('event_participants', id).order('created_at'), byEvent('event_members', id),
    supabase.from('workspace_members').select('profile:profiles(*)').eq('workspace_id', event.workspace_id),
    byEvent('travel_segments', id).order('depart_local'), byEvent('travel_segment_travelers', id), byEvent('accommodations', id).order('check_in_local'), byEvent('accommodation_guests', id),
    byEvent('competition_sessions', id).order('session_date').order('start_time'), byEvent('competition_session_participants', id),
    byEvent('packing_lists', id).order('created_at'), byEvent('packing_items', id).order('position'), byEvent('tasks', id).order('due_date', { nullsFirst: false }), byEvent('notes', id).order('updated_at', { ascending: false }),
    byEvent('documents', id).order('created_at', { ascending: false }), byEvent('comments', id).order('created_at'),
    byEvent('activity_log', id).eq('is_quiet', false).order('created_at', { ascending: false }).limit(30),
    supabase.rpc('event_role', { p_event: id }),
  ]);
  const m = must as <T>(r: unknown) => T;
  return {
    event, days: m(days), items: m(items), itemPeople: m(itemPeople), participants: m(participants), members: m(members),
    profiles: (m<{ profile: Profile }[]>(wm)).map((r) => r.profile).filter(Boolean), travel: m(travel), travelers: m(travelers), stays: m(stays), guests: m(guests), sessions: m(sessions), sessionPeople: m(sessionPeople),
    lists: m(lists), packing: m(packing), tasks: m(tasks), notes: m(notes), documents: m(documents), comments: m(comments), activity: m(activity), myRole: m<EventRole>(role),
  };
}
/** Network first; the encrypted snapshot is used only if the network is unreachable. */
export async function loadBundle(id: string): Promise<EventBundle & { fromCache?: boolean }> {
  const overlay = <B extends EventBundle>(b: B) => ({ ...b, packing: overlayPending(b.packing, id) });
  try {
    if (!navigator.onLine) throw new Error('network offline');
    const b = await fetchBundle(id);
    void secureStore.set(`bundle:${id}`, b);
    return overlay(b);
  } catch (e) {
    if (isNetworkError(e)) { const c = await secureStore.get<EventBundle>(`bundle:${id}`); if (c) return { ...overlay(c), fromCache: true }; }
    throw e;
  }
}
export type EventListRow = EventRow & { event_participants: { display_name: string; user_id: string | null }[] };
export async function loadEvents(): Promise<EventListRow[]> {
  try {
    if (!navigator.onLine) throw new Error('network offline');
    const rows = must(await supabase.from('events').select('*, event_participants(display_name,user_id)').order('start_date')) as unknown as EventListRow[];
    void secureStore.set('events', rows);
    return rows;
  } catch (e) {
    if (isNetworkError(e)) { const c = await secureStore.get<EventListRow[]>('events'); if (c) return c; }
    throw e;
  }
}
export async function loadWorkspaces(uid: string): Promise<{ workspace: Workspace; role: WorkspaceMember['role'] }[]> {
  try {
    if (!navigator.onLine) throw new Error('network offline');
    const rows = must(await supabase.from('workspace_members').select('role, workspace:workspaces(*)').eq('user_id', uid).order('created_at')) as unknown as { workspace: Workspace; role: WorkspaceMember['role'] }[];
    void secureStore.set('workspaces', rows);
    return rows;
  } catch (e) {
    if (isNetworkError(e)) { const c = await secureStore.get<any>('workspaces'); if (c) return c; }
    throw e;
  }
}
export const loadWorkspaceMembers = async (ws: string) => must(await supabase.from('workspace_members').select('*, profile:profiles(*)').eq('workspace_id', ws).order('created_at')) as unknown as WorkspaceMember[];

export async function insertRow<T = any>(table: string, row: Record<string, unknown>): Promise<T> {
  return must(await supabase.from(table).insert(row).select().single()) as T;
}
export async function updateRow(table: string, id: string, patch: Record<string, unknown>) { must(await supabase.from(table).update(patch).eq('id', id).select('id')); }
export async function deleteRow(table: string, id: string) { must(await supabase.from(table).delete().eq('id', id).select('id')); }

/** Optimistic concurrency: never silently overwrite someone else's newer save. */
export async function saveVersioned(table: string, row: { id: string; version: number }, patch: Record<string, unknown>) {
  let version = row.version;
  for (let i = 0; i < 3; i++) {
    const data = must(await supabase.from(table).update(patch).eq('id', row.id).eq('version', version).select('id')) as unknown[];
    if (data.length) return;
    const cur = must(await supabase.from(table).select('version').eq('id', row.id).maybeSingle()) as { version: number } | null;
    if (!cur) throw new Error('This was deleted by someone else.');
    const overwrite = await confirmDialog({ title: 'Someone else just changed this', body: 'Your edit was made on an older copy. You can replace their version with yours, or keep theirs and discard your edit.', action: 'Replace with mine', cancel: 'Keep theirs' });
    if (!overwrite) throw new CancelledError();
    version = cur.version;
  }
  throw new Error('This keeps changing. Close it and try again.');
}
export async function setPeople(table: string, parentCol: string, parentId: string, eventId: string, next: string[]) {
  const cur = must(await supabase.from(table).select('participant_id').eq(parentCol, parentId)) as { participant_id: string }[];
  const have = cur.map((c) => c.participant_id);
  const del = have.filter((x) => !next.includes(x)), add = next.filter((x) => !have.includes(x));
  if (del.length) must(await supabase.from(table).delete().eq(parentCol, parentId).in('participant_id', del).select());
  if (add.length) must(await supabase.from(table).insert(add.map((participant_id) => ({ [parentCol]: parentId, participant_id, event_id: eventId }))).select());
}
export async function rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T> { return must(await supabase.rpc(fn, args)) as T; }

export type DocLink = Partial<Record<'itinerary_item_id' | 'travel_segment_id' | 'accommodation_id' | 'competition_session_id' | 'task_id', string>>;
export const safeName = (n: string) => n.replace(/[^\w.\-]+/g, '_').slice(-80);
export async function uploadDocument(eventId: string, file: File, opts: DocLink & { doc_type?: string } = {}) {
  if (file.size > 25 * 1024 * 1024) throw new Error('That file is too large. The limit is 25 MB.');
  const path = `${eventId}/${uuid()}-${safeName(file.name)}`;
  const up = await supabase.storage.from('event-files').upload(path, file, { contentType: file.type || undefined, cacheControl: '3600' });
  if (up.error) throw up.error;
  try { return await insertRow('documents', { event_id: eventId, name: file.name.slice(0, 200), storage_path: path, mime_type: file.type || null, size_bytes: file.size, ...opts }); }
  catch (e) { await supabase.storage.from('event-files').remove([path]); throw e; }
}
export async function deleteDocument(d: { id: string; storage_path: string }) {
  await deleteRow('documents', d.id);
  await supabase.storage.from('event-files').remove([d.storage_path]);
}
export async function signedUrl(path: string, expires = 3600) {
  const r = await supabase.storage.from('event-files').createSignedUrl(path, expires);
  if (r.error) throw r.error;
  return r.data.signedUrl;
}
export async function uploadCover(eventId: string, file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const path = `${eventId}/cover/${uuid()}-${safeName(file.name)}`;
  const up = await supabase.storage.from('event-files').upload(path, file, { contentType: file.type });
  if (up.error) throw up.error;
  return path;
}
