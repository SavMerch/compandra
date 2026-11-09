import * as React from 'react';
import { Check, Copy, Luggage, Plus, Save, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Avatar, EmptyState, Field, Input, Progress, Select, Textarea } from '@/components/ui/misc';
import { confirmDialog } from '@/components/ui/confirm';
import { deleteRow, insertRow, rpc, updateRow } from '@/data/api';
import { useEvents, useTogglePacked } from '@/data/hooks';
import { packingCategories, packingProgress, parsePackingLines } from '@/domain/packing';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useEvent } from '../event/EventContext';
import type { PackingItem, PackingList, PackingTemplate } from '@/domain/types';

export function PackingPage() {
  const { b, canEdit, run } = useEvent();
  const [listId, setListId] = React.useState(b.lists[0]?.id ?? '');
  const [newList, setNewList] = React.useState(false);
  const [add, setAdd] = React.useState(false);
  const [edit, setEdit] = React.useState<PackingItem | null>(null);
  const [copy, setCopy] = React.useState(false);
  const list = b.lists.find((l) => l.id === listId) ?? b.lists[0];
  const items = b.packing.filter((p) => p.list_id === list?.id);
  const p = packingProgress(items);
  const cats = [...new Set(items.map((i) => i.category))].sort((a, x) => packingCategories.indexOf(a) - packingCategories.indexOf(x));
  const saveTemplate = async () => { if (!list) return; await run(() => insertRow('packing_templates', { workspace_id: b.event.workspace_id, name: list.name, items: items.map((i) => ({ name: i.name, category: i.category, quantity: i.quantity })) }), 'Saved as a template'); };
  const removeList = async () => { if (list && await confirmDialog({ title: `Delete ${list.name}?`, body: 'All items on this list are removed for everyone.', action: 'Delete', destructive: true })) { await run(() => deleteRow('packing_lists', list.id).then(() => true), 'Deleted'); setListId(''); } };
  return (
    <div className="mx-auto max-w-2xl p-4 lg:p-6">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-[26px] font-bold">Packing</h2>{canEdit && <Button variant="soft" onClick={() => setNewList(true)}><Plus className="h-5 w-5" />New list</Button>}</div>
      {!b.lists.length ? <EmptyState icon={Luggage} title="No packing lists yet" body="Start a shared family list or one for each person.">{canEdit && <Button onClick={() => setNewList(true)}>Create a list</Button>}</EmptyState> : <>
        <div role="tablist" aria-label="Packing lists" className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
          {b.lists.map((l) => { const lp = packingProgress(b.packing.filter((x) => x.list_id === l.id)); return <button key={l.id} role="tab" aria-selected={list?.id === l.id} onClick={() => setListId(l.id)} className={cn('min-h-11 shrink-0 rounded-full px-4 font-semibold', list?.id === l.id ? 'bg-ink text-white' : 'bg-card shadow-soft')}>{l.name} <span className="font-normal opacity-75">{lp.done}/{lp.total}</span></button>; })}
        </div>
        <div className="mb-4 space-y-1.5"><Progress value={p.pct} label={`${list?.name} progress`} /><p className="text-[15px] text-ink-soft">{p.done} of {p.total} packed</p></div>
        {!items.length && <p className="mb-4 text-ink-soft">This list is empty.</p>}
        <div className="space-y-5">{cats.map((c) => <section key={c}><h3 className="mb-1.5 font-display text-lg font-semibold">{c}</h3><ul className="overflow-hidden rounded-2xl bg-card shadow-soft">{items.filter((i) => i.category === c).map((i) => <Row key={i.id} item={i} onEdit={() => setEdit(i)} />)}</ul></section>)}</div>
        {canEdit && <div className="mt-5 grid grid-cols-2 gap-2"><Button className="col-span-2" size="lg" onClick={() => setAdd(true)}><Plus className="h-5 w-5" />Add items</Button><Button variant="soft" onClick={saveTemplate}><Save className="h-4 w-4" />Save template</Button><Button variant="soft" onClick={() => setCopy(true)}><Copy className="h-4 w-4" />Reuse a list</Button><Button className="col-span-2" variant="dangerSoft" onClick={removeList}><Trash2 className="h-4 w-4" />Delete this list</Button></div>}
      </>}
      {b.lists.length === 0 && canEdit && <div className="text-center"><Button variant="soft" onClick={() => setCopy(true)}><Copy className="h-4 w-4" />Reuse a list</Button></div>}
      {newList && <NewListSheet onClose={() => setNewList(false)} onMade={setListId} />}
      {add && list && <AddItemsSheet list={list} onClose={() => setAdd(false)} />}
      {edit && <EditItemSheet item={edit} onClose={() => setEdit(null)} />}
      {copy && <ReuseSheet onClose={() => setCopy(false)} onMade={setListId} />}
    </div>
  );
}
function Row({ item, onEdit }: { item: PackingItem; onEdit: () => void }) {
  const { b, canEdit, userId } = useEvent();
  const toggle = useTogglePacked(b.event.id);
  const who = b.participants.find((p) => p.id === item.assigned_participant_id);
  const canTick = canEdit || !who || who.user_id === userId;
  return (
    <li className="flex items-center border-b border-line last:border-0">
      <button role="checkbox" aria-checked={item.is_packed} aria-label={item.name} disabled={!canTick} onClick={() => toggle(item.id, !item.is_packed)} className="grid min-h-14 w-14 shrink-0 place-items-center disabled:opacity-40">
        <span className={cn('grid h-7 w-7 place-items-center rounded-lg border-2 transition', item.is_packed ? 'border-teal bg-teal text-white' : 'border-line')}>{item.is_packed && <Check className="h-5 w-5" aria-hidden />}</span>
      </button>
      <button disabled={!canEdit} onClick={onEdit} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 pr-3 text-left">
        <span className={cn('min-w-0 flex-1', item.is_packed && 'text-ink-soft line-through')}><span className="block truncate">{item.name}{item.quantity > 1 ? ` (${item.quantity})` : ''}</span>{item.notes && <span className="block truncate text-sm text-ink-soft">{item.notes}</span>}</span>
        {who && <Avatar name={who.display_name} size={28} />}
      </button>
    </li>
  );
}
function NewListSheet({ onClose, onMade }: { onClose: () => void; onMade: (id: string) => void }) {
  const { b, run, people } = useEvent();
  const [name, setName] = React.useState(''); const [owner, setOwner] = React.useState('');
  const tmpl = useQuery({ queryKey: ['templates', b.event.workspace_id], queryFn: async () => (await supabase.from('packing_templates').select('*').eq('workspace_id', b.event.workspace_id)).data as PackingTemplate[] });
  const [t, setT] = React.useState('');
  return <Sheet open onOpenChange={(o) => !o && onClose()} title="New packing list"><form className="space-y-4 pb-3" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; const made = await run(async () => { const l = await insertRow('packing_lists', { event_id: b.event.id, name: name.trim(), kind: owner ? 'individual' : 'shared', owner_participant_id: owner || null }); const chosen = tmpl.data?.find((x) => x.id === t); if (chosen?.items.length) { const { error } = await supabase.from('packing_items').insert(chosen.items.map((i, n) => ({ ...i, event_id: b.event.id, list_id: l.id, position: n * 1000 }))); if (error) throw error; } return l; }, 'List created'); if (made) { onMade(made.id); onClose(); } }}>
    <Field label="List name" htmlFor="ln"><Input id="ln" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Family packing" /></Field>
    <Field label="Whose list" htmlFor="lo"><Select id="lo" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Shared by everyone</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
    {!!tmpl.data?.length && <Field label="Start from template" htmlFor="lt"><Select id="lt" value={t} onChange={(e) => setT(e.target.value)}><option value="">Blank list</option>{tmpl.data.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.items.length})</option>)}</Select></Field>}
    <Button type="submit" size="lg" className="w-full">Create list</Button></form></Sheet>;
}
function AddItemsSheet({ list, onClose }: { list: PackingList; onClose: () => void }) {
  const { b, run } = useEvent();
  const [text, setText] = React.useState(''); const [cat, setCat] = React.useState('');
  const parsed = parsePackingLines(text, cat || undefined);
  return <Sheet open onOpenChange={(o) => !o && onClose()} title={`Add to ${list.name}`}><form className="space-y-4 pb-3" onSubmit={async (e) => { e.preventDefault(); if (!parsed.length) return; const base = Date.now() / 1000; const ok = await run(async () => { const { error } = await supabase.from('packing_items').insert(parsed.map((p, i) => ({ ...p, event_id: b.event.id, list_id: list.id, position: base + i }))); if (error) throw error; return true; }, `${parsed.length} item${parsed.length > 1 ? 's' : ''} added`); if (ok) onClose(); }}>
    <Field label="One item per line" htmlFor="ai" hint='"Socks x3" sets a quantity. Categories are guessed for you.'><Textarea id="ai" rows={6} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={'Sunscreen\nPhone chargers\nSwimsuits'} /></Field>
    <Field label="Category" htmlFor="ac"><Select id="ac" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Guess for me</option>{packingCategories.map((c) => <option key={c}>{c}</option>)}</Select></Field>
    <Button type="submit" size="lg" className="w-full" disabled={!parsed.length}>{parsed.length ? `Add ${parsed.length} item${parsed.length > 1 ? 's' : ''}` : 'Add items'}</Button></form></Sheet>;
}
function EditItemSheet({ item, onClose }: { item: PackingItem; onClose: () => void }) {
  const { run, people } = useEvent();
  const [v, set] = React.useState({ name: item.name, category: item.category, quantity: item.quantity, notes: item.notes ?? '', assigned_participant_id: item.assigned_participant_id ?? '' });
  const [custom, setCustom] = React.useState(!packingCategories.includes(item.category));
  return <Sheet open onOpenChange={(o) => !o && onClose()} title="Edit item"><form className="space-y-4 pb-3" onSubmit={async (e) => { e.preventDefault(); if (!v.name.trim()) return; const ok = await run(() => updateRow('packing_items', item.id, { ...v, name: v.name.trim(), category: v.category.trim() || 'Miscellaneous', notes: v.notes || null, assigned_participant_id: v.assigned_participant_id || null }).then(() => true), 'Saved'); if (ok) onClose(); }}>
    <Field label="Item" htmlFor="en"><Input id="en" value={v.name} onChange={(e) => set({ ...v, name: e.target.value })} /></Field>
    <Field label="Category" htmlFor="ec"><Select id="ec" value={custom ? '__c' : v.category} onChange={(e) => { if (e.target.value === '__c') setCustom(true); else { setCustom(false); set({ ...v, category: e.target.value }); } }}>{packingCategories.map((c) => <option key={c}>{c}</option>)}<option value="__c">Custom category</option></Select></Field>
    {custom && <Field label="Custom category" htmlFor="ecc"><Input id="ecc" value={v.category} onChange={(e) => set({ ...v, category: e.target.value })} /></Field>}
    <Field label="Quantity" htmlFor="eq"><Input id="eq" type="number" min={1} max={999} value={v.quantity} onChange={(e) => set({ ...v, quantity: Math.max(1, Number(e.target.value) || 1) })} /></Field>
    <Field label="Assigned to" htmlFor="ea"><Select id="ea" value={v.assigned_participant_id} onChange={(e) => set({ ...v, assigned_participant_id: e.target.value })}><option value="">Anyone</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
    <Field label="Notes" htmlFor="eno"><Input id="eno" value={v.notes} onChange={(e) => set({ ...v, notes: e.target.value })} /></Field>
    <Button type="submit" size="lg" className="w-full">Save changes</Button>
    <Button variant="dangerSoft" className="w-full" onClick={async () => { const ok = await run(() => deleteRow('packing_items', item.id).then(() => true), 'Removed'); if (ok) onClose(); }}>Remove item</Button></form></Sheet>;
}
function ReuseSheet({ onClose, onMade }: { onClose: () => void; onMade: (id: string) => void }) {
  const { b, run } = useEvent();
  const evs = useEvents();
  const others = (evs.data ?? []).filter((e) => e.id !== b.event.id);
  const lists = useQuery({ queryKey: ['reuse-lists', others.map((o) => o.id).join()], enabled: others.length > 0, queryFn: async () => (await supabase.from('packing_lists').select('*').in('event_id', others.map((o) => o.id))).data as PackingList[] });
  return <Sheet open onOpenChange={(o) => !o && onClose()} title="Reuse a list"><div className="space-y-2 pb-3">{lists.data?.length ? lists.data.map((l) => <button key={l.id} className="flex min-h-14 w-full flex-col justify-center rounded-2xl bg-card px-4 py-2 text-left shadow-soft" onClick={async () => { const id = await run(() => rpc<string>('copy_packing_list', { p_list: l.id, p_target_event: b.event.id }), 'List copied, all items unchecked'); if (id) { onMade(id); onClose(); } }}><span className="font-semibold">{l.name}</span><span className="text-[15px] text-ink-soft">{others.find((o) => o.id === l.event_id)?.title}</span></button>) : <p className="text-ink-soft">No lists from other events yet.</p>}</div></Sheet>;
}
