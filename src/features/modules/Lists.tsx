import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState, Field, Input, Progress, Textarea } from '@/components/ui/misc';
import { confirmDialog } from '@/components/ui/confirm';
import { deleteRow, insertRow, updateRow } from '@/data/api';
import { keys } from '@/data/hooks';
import { cn } from '@/lib/utils';
import type { EventBundle, EventListItem } from '@/domain/types';
import { useEvent } from '../event/EventContext';

const PRESETS = ['Grocery', 'Supplies', 'Places To Visit', 'Restaurants', 'Gifts'];

export function ListsPage() {
  const { b, canEdit, run } = useEvent();
  // Snapshots saved offline before Lists existed have no list data.
  const lists = b.checklists ?? [];
  const allItems = b.checklistItems ?? [];
  const [listId, setListId] = React.useState(lists[0]?.id ?? '');
  const [creating, setCreating] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const [editing, setEditing] = React.useState<EventListItem | null>(null);
  const [text, setText] = React.useState('');
  const list = lists.find((l) => l.id === listId) ?? lists[0];
  const items = allItems.filter((i) => i.list_id === list?.id);
  const open = items.filter((i) => !i.is_done), done = items.filter((i) => i.is_done);
  const pct = items.length ? Math.round((done.length / items.length) * 100) : 0;
  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = text.trim();
    if (!name || !list) return;
    setText('');
    const ok = await run(() => insertRow('event_list_items', { event_id: b.event.id, list_id: list.id, name: name.slice(0, 200), position: Date.now() / 1000 }));
    if (!ok) setText(name);
  };
  const removeList = async () => {
    if (list && await confirmDialog({ title: `Delete ${list.name}?`, body: 'All items on this list are removed for everyone.', action: 'Delete', destructive: true })) {
      const ok = await run(() => deleteRow('event_lists', list.id).then(() => true), 'List deleted');
      if (ok) setListId('');
    }
  };
  return (
    <div className="mx-auto max-w-2xl p-4 lg:p-6">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-[26px] font-bold">Lists</h2>{canEdit && lists.length > 0 && <Button variant="soft" onClick={() => setCreating(true)}><Plus className="h-5 w-5" />New list</Button>}</div>
      {!lists.length ? (
        <EmptyState icon={ListChecks} title="No lists yet" body="Keep groceries, supplies, places to visit, or anything else in one shared list.">{canEdit && <Button onClick={() => setCreating(true)}>Create a list</Button>}</EmptyState>
      ) : <>
        <div role="tablist" aria-label="Lists" className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
          {lists.map((l) => { const li = allItems.filter((x) => x.list_id === l.id); return <button key={l.id} role="tab" aria-selected={list?.id === l.id} onClick={() => setListId(l.id)} className={cn('min-h-11 shrink-0 rounded-full px-4 font-semibold', list?.id === l.id ? 'bg-ink text-white' : 'bg-card shadow-soft')}>{l.name} <span className="font-normal opacity-75">{li.filter((x) => x.is_done).length}/{li.length}</span></button>; })}
        </div>
        <div className="mb-4 space-y-1.5"><Progress value={pct} label={`${list?.name} progress`} /><p className="text-[15px] text-ink-soft">{done.length} of {items.length} done</p></div>
        {canEdit && <form onSubmit={addItem} className="mb-4 flex gap-2"><Input aria-label={`Add to ${list?.name}`} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Add to ${list?.name}`} maxLength={200} /><Button type="submit" size="icon" aria-label="Add item" className="h-12 w-12 shrink-0"><Plus className="h-5 w-5" /></Button></form>}
        {!items.length && <p className="text-ink-soft">This list is empty.</p>}
        {open.length > 0 && <ul className="overflow-hidden rounded-2xl bg-card shadow-soft">{open.map((i) => <Row key={i.id} item={i} onEdit={() => setEditing(i)} />)}</ul>}
        {done.length > 0 && <section className="mt-5"><h3 className="mb-1.5 font-display text-lg font-semibold">Done</h3><ul className="overflow-hidden rounded-2xl bg-card shadow-soft">{done.map((i) => <Row key={i.id} item={i} onEdit={() => setEditing(i)} />)}</ul></section>}
        {canEdit && <div className="mt-5 grid grid-cols-2 gap-2"><Button variant="soft" onClick={() => setRenaming(true)}><Pencil className="h-4 w-4" />Rename list</Button><Button variant="dangerSoft" onClick={removeList}><Trash2 className="h-4 w-4" />Delete list</Button></div>}
      </>}
      {creating && <NewListSheet onClose={() => setCreating(false)} onMade={setListId} existing={lists.map((l) => l.name)} />}
      {renaming && list && <RenameSheet id={list.id} name={list.name} onClose={() => setRenaming(false)} />}
      {editing && <EditItemSheet item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
function Row({ item, onEdit }: { item: EventListItem; onEdit: () => void }) {
  const { b, canEdit, run } = useEvent();
  const qc = useQueryClient();
  const toggle = () => {
    const next = !item.is_done;
    qc.setQueryData<EventBundle>(keys.bundle(b.event.id), (o) => o && ({ ...o, checklistItems: o.checklistItems.map((x) => (x.id === item.id ? { ...x, is_done: next } : x)) }));
    void run(() => updateRow('event_list_items', item.id, { is_done: next }).then(() => true));
  };
  return (
    <li className="flex items-center border-b border-line last:border-0">
      <button role="checkbox" aria-checked={item.is_done} aria-label={item.name} onClick={toggle} className="grid min-h-14 w-14 shrink-0 place-items-center">
        <span className={cn('grid h-7 w-7 place-items-center rounded-lg border-2 transition', item.is_done ? 'border-teal bg-teal text-white' : 'border-line')}>{item.is_done && <Check className="h-5 w-5" aria-hidden />}</span>
      </button>
      <button disabled={!canEdit} onClick={onEdit} className="flex min-h-14 min-w-0 flex-1 flex-col justify-center py-2 pr-3 text-left">
        <span className={cn('break-words', item.is_done && 'text-ink-soft line-through')}>{item.name}</span>
        {item.notes && <span className="block break-words text-sm text-ink-soft">{item.notes}</span>}
      </button>
    </li>
  );
}
function NewListSheet({ onClose, onMade, existing }: { onClose: () => void; onMade: (id: string) => void; existing: string[] }) {
  const { b, run } = useEvent();
  const [name, setName] = React.useState('');
  const create = async (n: string) => {
    const clean = n.trim();
    if (!clean) { toast.error('Give the list a name.'); return; }
    const made = await run(() => insertRow<{ id: string }>('event_lists', { event_id: b.event.id, name: clean.slice(0, 80), position: Date.now() / 1000 }), 'List created');
    if (made) { onMade(made.id); onClose(); }
  };
  const presets = PRESETS.filter((p) => !existing.some((e) => e.toLowerCase() === p.toLowerCase()));
  return <Sheet open onOpenChange={(o) => !o && onClose()} title="New list"><div className="space-y-5 pb-3">
    {presets.length > 0 && <div className="grid grid-cols-2 gap-2">{presets.map((p) => <Button key={p} variant="soft" size="lg" onClick={() => create(p)}>{p}</Button>)}</div>}
    <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); void create(name); }}><Field label="Or create your own" htmlFor="cl"><Input id="cl" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Beach day ideas" /></Field><Button type="submit" size="lg" className="w-full">Create list</Button></form>
  </div></Sheet>;
}
function RenameSheet({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const { run } = useEvent();
  const [v, setV] = React.useState(name);
  return <Sheet open onOpenChange={(o) => !o && onClose()} title="Rename list"><form noValidate className="space-y-4 pb-3" onSubmit={async (e) => { e.preventDefault(); if (!v.trim()) { toast.error('Give the list a name.'); return; } const ok = await run(() => updateRow('event_lists', id, { name: v.trim() }).then(() => true), 'List renamed'); if (ok) onClose(); }}><Field label="List name" htmlFor="rl"><Input id="rl" maxLength={80} autoFocus value={v} onChange={(e) => setV(e.target.value)} /></Field><Button type="submit" size="lg" className="w-full">Save name</Button></form></Sheet>;
}
function EditItemSheet({ item, onClose }: { item: EventListItem; onClose: () => void }) {
  const { run } = useEvent();
  const [name, setName] = React.useState(item.name); const [notes, setNotes] = React.useState(item.notes ?? '');
  return <Sheet open onOpenChange={(o) => !o && onClose()} title="Edit item"><form noValidate className="space-y-4 pb-3" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) { toast.error('Give the item a name.'); return; } const ok = await run(() => updateRow('event_list_items', item.id, { name: name.trim(), notes: notes.trim() || null }).then(() => true), 'Saved'); if (ok) onClose(); }}>
    <Field label="Item" htmlFor="li"><Input id="li" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} /></Field>
    <Field label="Notes" htmlFor="ln2"><Textarea id="ln2" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Address, brand, or quantity" /></Field>
    <Button type="submit" size="lg" className="w-full">Save changes</Button>
    <Button variant="dangerSoft" className="w-full" onClick={async () => { const ok = await run(() => deleteRow('event_list_items', item.id).then(() => true), 'Removed'); if (ok) onClose(); }}>Remove item</Button>
  </form></Sheet>;
}
