import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, CheckSquare, NotebookPen, Pin, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Avatar, Badge, EmptyState, Input, Select } from '@/components/ui/misc';
import { SimpleForm, type FieldDef } from '@/components/SimpleForm';
import { confirmDialog } from '@/components/ui/confirm';
import { deleteRow, insertRow, saveVersioned } from "@/data/api";
import { formatDayShort, timeAgo } from '@/domain/time';
import { cn, nullify } from '@/lib/utils';
import { useEvent } from '../event/EventContext';
import type { Note, Task } from '@/domain/types';

export function TasksPage() {
  const { b, canEdit, userId, run, today, personName } = useEvent();
  const [filter, setFilter] = React.useState('all');
  const [showDone, setShowDone] = React.useState(false);
  const [form, setForm] = React.useState<{ row?: Task } | null>(null);
  const [sp, setSp] = useSearchParams();
  React.useEffect(() => { if (sp.get('new') === '1') { setForm({}); setSp({}, { replace: true }); } }, [sp, setSp]);
  const members = b.profiles.filter((p) => b.participants.some((x) => x.user_id === p.id) || b.members.some((m) => m.user_id === p.id));
  const visible = b.tasks.filter((t) => filter === 'all' || (filter === 'unassigned' ? !t.assignee_id : t.assignee_id === filter));
  const open = visible.filter((t) => t.status !== 'done'), done = visible.filter((t) => t.status === 'done');
  const row = form?.row;
  const comments = row ? b.comments.filter((c) => c.task_id === row.id) : [];
  const fields: FieldDef[] = [{ name: 'title', label: 'Task', required: true }, { name: 'assignee_id', label: 'Assigned to', type: 'select', options: [{ value: '', label: 'Anyone' }, ...members.map((m) => ({ value: m.id, label: m.display_name || 'Family member' }))] }, { name: 'due_date', label: 'Due', type: 'date', half: true }, { name: 'priority', label: 'Priority', type: 'select', half: true, options: [{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }] }, { name: 'status', label: 'Status', type: 'select', options: [{ value: 'open', label: 'To do' }, { value: 'in_progress', label: 'In progress' }, { value: 'done', label: 'Done' }] }, { name: 'itinerary_item_id', label: 'Related activity', type: 'select', options: [{ value: '', label: 'None' }, ...b.items.map((i) => ({ value: i.id, label: i.title }))] }, { name: 'description', label: 'Details', type: 'textarea' }];
  const submit = async (v: Record<string, any>) => { const p = nullify({ ...v, title: v.title.trim() }); const ok = await run(() => (row ? saveVersioned('tasks', row, p) : insertRow('tasks', { event_id: b.event.id, ...p })).then(() => true), row ? 'Saved' : 'Task added'); if (ok) setForm(null); };
  const Item = ({ t }: { t: Task }) => {
    const can = canEdit || t.assignee_id === userId, isDone = t.status === 'done', late = !isDone && t.due_date && t.due_date < today;
    return <li className="flex items-center rounded-2xl bg-card shadow-soft">
      <button role="checkbox" aria-checked={isDone} aria-label={t.title} disabled={!can} onClick={() => run(() => saveVersioned('tasks', t, { status: isDone ? 'open' : 'done' }).then(() => true))} className="grid min-h-16 w-14 shrink-0 place-items-center disabled:opacity-40"><span className={cn('grid h-7 w-7 place-items-center rounded-full border-2', isDone ? 'border-teal bg-teal text-white' : 'border-line')}>{isDone && <Check className="h-5 w-5" aria-hidden />}</span></button>
      <button onClick={() => setForm({ row: t })} className="flex min-h-16 min-w-0 flex-1 items-center gap-2 py-2 pr-3 text-left"><span className="min-w-0 flex-1"><span className={cn('block font-semibold leading-snug', isDone && 'text-ink-soft line-through')}>{t.title}</span><span className="mt-0.5 flex flex-wrap gap-1.5">{t.due_date && <Badge tone={late ? 'danger' : 'neutral'}>{late ? 'Overdue: ' : ''}{formatDayShort(t.due_date)}</Badge>}{t.priority === 'high' && <Badge tone="accent">High</Badge>}{t.status === 'in_progress' && <Badge tone="teal">In progress</Badge>}</span></span>{t.assignee_id && <Avatar name={personName(t.assignee_id) === 'You' ? b.profiles.find((p) => p.id === userId)?.display_name : personName(t.assignee_id)} size={30} />}</button>
    </li>;
  };
  const [c, setC] = React.useState('');
  return (
    <div className="mx-auto max-w-2xl p-4 lg:p-6">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-[26px] font-bold">Tasks</h2>{canEdit && <Button onClick={() => setForm({})}><Plus className="h-5 w-5" />Add</Button>}</div>
      <Select aria-label="Filter tasks" className="mb-3" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Everyone</option><option value={userId}>Assigned to me</option><option value="unassigned">Unassigned</option>{members.filter((m) => m.id !== userId).map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</Select>
      {!open.length && !done.length ? <EmptyState icon={CheckSquare} title="No tasks here" body="Add what needs doing and assign it to someone." /> : <ul className="space-y-2">{open.map((t) => <Item key={t.id} t={t} />)}</ul>}
      {done.length > 0 && <div className="mt-4"><Button variant="ghost" onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide' : 'Show'} {done.length} done</Button>{showDone && <ul className="mt-2 space-y-2">{done.map((t) => <Item key={t.id} t={t} />)}</ul>}</div>}
      {form && <Sheet open onOpenChange={(o) => !o && setForm(null)} title={row ? (canEdit ? 'Edit task' : row.title) : 'New task'}>
        {canEdit ? <SimpleForm fields={fields} submitLabel={row ? 'Save changes' : 'Add task'} onSubmit={submit} defaults={{ title: row?.title ?? '', assignee_id: row?.assignee_id ?? '', due_date: row?.due_date ?? '', priority: row?.priority ?? 'normal', status: row?.status ?? 'open', itinerary_item_id: row?.itinerary_item_id ?? '', description: row?.description ?? '' }} onDelete={row ? async () => { if (await confirmDialog({ title: 'Delete this task?', action: 'Delete', destructive: true })) { const ok = await run(() => deleteRow('tasks', row.id).then(() => true), 'Deleted'); if (ok) setForm(null); } } : undefined} /> : <p className="pb-3 whitespace-pre-wrap">{row?.description || 'No details.'}</p>}
        {row && <section aria-label="Comments" className="mt-4 space-y-2.5 pb-3"><h3 className="font-display text-lg font-semibold">Comments</h3>{comments.map((x) => <div key={x.id} className="flex gap-2.5"><Avatar name={personName(x.created_by)} size={30} /><div><div className="text-sm text-ink-soft">{personName(x.created_by)}, {timeAgo(x.created_at)}</div><p>{x.body}</p></div></div>)}<form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!c.trim()) return; const ok = await run(() => insertRow('comments', { event_id: b.event.id, task_id: row.id, body: c.trim(), created_by: userId })); if (ok) setC(''); }}><Input aria-label="Add a comment" value={c} onChange={(e) => setC(e.target.value)} placeholder="Add a comment" /><Button type="submit" size="icon" className="h-12 w-12 shrink-0" aria-label="Send comment"><Send className="h-5 w-5" /></Button></form></section>}
      </Sheet>}
    </div>
  );
}
export function NotesPage() {
  const { b, canEdit, run, personName } = useEvent();
  const [form, setForm] = React.useState<{ row?: Note } | null>(null);
  const row = form?.row;
  const notes = [...b.notes].sort((x, y) => Number(y.is_pinned) - Number(x.is_pinned));
  const fields: FieldDef[] = [{ name: 'title', label: 'Title' }, { name: 'body', label: 'Note', type: 'textarea', required: true }, { name: 'is_pinned', label: 'Pin to the Today screen', type: 'checkbox' }];
  return (
    <div className="mx-auto max-w-2xl p-4 lg:p-6">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-[26px] font-bold">Notes</h2>{canEdit && <Button onClick={() => setForm({})}><Plus className="h-5 w-5" />Add</Button>}</div>
      {!notes.length && <EmptyState icon={NotebookPen} title="No notes yet" body="Keep parking tips, door codes, and reminders here." />}
      <ul className="space-y-2">{notes.map((n) => <li key={n.id}><button disabled={!canEdit} onClick={() => setForm({ row: n })} className={cn('block w-full rounded-2xl p-4 text-left shadow-soft', n.is_pinned ? 'bg-gold-soft' : 'bg-card')}><span className="flex items-center gap-1.5 font-semibold">{n.is_pinned && <Pin className="h-4 w-4 text-gold" aria-label="Pinned" />}{n.title || 'Note'}</span><span className="mt-1 block whitespace-pre-wrap">{n.body}</span><span className="mt-2 block text-sm text-ink-soft">{personName(n.updated_by)}, {timeAgo(n.updated_at)}</span></button></li>)}</ul>
      {form && <Sheet open onOpenChange={(o) => !o && setForm(null)} title={row ? 'Edit note' : 'New note'}><SimpleForm fields={fields} submitLabel={row ? 'Save changes' : 'Add note'} defaults={{ title: row?.title ?? '', body: row?.body ?? '', is_pinned: row?.is_pinned ?? false }} onSubmit={async (v) => { const ok = await run(() => (row ? saveVersioned('notes', row, v) : insertRow('notes', { event_id: b.event.id, ...v })).then(() => true), row ? 'Saved' : 'Note added'); if (ok) setForm(null); }} onDelete={row ? async () => { if (await confirmDialog({ title: 'Delete this note?', action: 'Delete', destructive: true })) { const ok = await run(() => deleteRow('notes', row.id).then(() => true), 'Deleted'); if (ok) setForm(null); } } : undefined} /></Sheet>}
    </div>
  );
}
