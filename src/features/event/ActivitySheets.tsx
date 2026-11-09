import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp, Clock, Copy, Link2, MapPin, Navigation, Pencil, Paperclip, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Avatar, Badge, Field, Input, Select, Textarea } from '@/components/ui/misc';
import { SimpleForm, type FieldDef } from '@/components/SimpleForm';
import { confirmDialog } from '@/components/ui/confirm';
import { deleteRow, insertRow, rpc, saveVersioned, setPeople, updateRow } from '@/data/api';
import { formatDayLong, formatDayShort, formatTime, hhmm, timeAgo } from '@/domain/time';
import { sortItems } from '@/domain/schedule';
import { copyText, openMaps } from '@/lib/platform';
import { nullify } from '@/lib/utils';
import type { Category, ItineraryItem } from '@/domain/types';
import { useEvent } from './EventContext';
import { DocList, UploadButton } from '../modules/Documents';
import { toast } from 'sonner';

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'activity', label: 'General activity' }, { value: 'meal', label: 'Meal' }, { value: 'travel', label: 'Travel' }, { value: 'flight', label: 'Flight' }, { value: 'hotel', label: 'Hotel check-in/out' },
  { value: 'competition', label: 'Competition' }, { value: 'reservation', label: 'Reservation' }, { value: 'entertainment', label: 'Entertainment' }, { value: 'free_time', label: 'Free time' }, { value: 'shopping', label: 'Shopping' }, { value: 'transportation', label: 'Transportation' }, { value: 'custom', label: 'Custom' },
];
const reminders = [{ value: '', label: 'No reminder' }, { value: '10', label: '10 minutes before' }, { value: '30', label: '30 minutes before' }, { value: '60', label: '1 hour before' }, { value: '120', label: '2 hours before' }];

export function ActivityFormSheet({ item, defaults, onClose }: { item?: ItineraryItem; defaults?: Partial<ItineraryItem>; onClose: () => void }) {
  const { b, run, people, today } = useEvent();
  const linked = !!item?.source_type;
  const dayOptions = [...b.days.map((d) => ({ value: d.id, label: formatDayLong(d.day_date) })), { value: '', label: 'Ideas (no date yet)' }];
  const initialPeople = item ? b.itemPeople.filter((x) => x.item_id === item.id).map((x) => x.participant_id) : [];
  const initDay = item ? item.event_day_id ?? '' : defaults && 'event_day_id' in defaults ? defaults.event_day_id ?? '' : (b.days.find((d) => d.day_date === today) ?? b.days[0])?.id ?? '';
  const fields: FieldDef[] = [
    ...(linked ? [] : [{ name: 'title', label: 'Title', required: true, placeholder: 'Lunch at the pier' } as FieldDef,
      { name: 'event_day_id', label: 'Day', type: 'select', options: dayOptions } as FieldDef,
      { name: 'is_all_day', label: 'All day', type: 'checkbox' } as FieldDef,
      { name: 'start_time', label: 'Start', type: 'time', half: true, show: (v) => !v.is_all_day } as FieldDef,
      { name: 'end_time', label: 'End', type: 'time', half: true, show: (v) => !v.is_all_day } as FieldDef,
      { name: 'category', label: 'Type', type: 'select', options: CATEGORIES } as FieldDef]),
    { name: 'location_name', label: 'Location', placeholder: 'Place name' }, { name: 'address', label: 'Address', placeholder: 'Used for Open in Maps' },
    { name: 'people', label: 'Who', type: 'people', people },
    ...(linked ? [] : [{ name: 'confirmation_number', label: 'Confirmation number' } as FieldDef]),
    { name: 'reservation_details', label: 'Reservation details', type: 'textarea' }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'notes', label: 'Notes', type: 'textarea' },
    { name: 'status', label: 'Status', type: 'select', options: [{ value: 'planned', label: 'Planned' }, { value: 'confirmed', label: 'Confirmed' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }] },
    { name: 'reminder_minutes', label: 'Reminder', type: 'select', options: reminders, hint: 'Shows in the app while it is open.' }, { name: 'is_optional', label: 'Optional', type: 'checkbox' },
  ];
  const v = { ...defaults, ...item };
  const initial = { title: v.title ?? '', event_day_id: initDay, is_all_day: v.is_all_day ?? false, start_time: hhmm(v.start_time), end_time: hhmm(v.end_time), category: v.category ?? 'activity', location_name: v.location_name ?? '', address: v.address ?? '', confirmation_number: v.confirmation_number ?? '', reservation_details: v.reservation_details ?? '', description: v.description ?? '', notes: v.notes ?? '', status: v.status ?? 'planned', reminder_minutes: v.reminder_minutes != null ? String(v.reminder_minutes) : '', is_optional: v.is_optional ?? false, people: initialPeople };
  const submit = async (form: Record<string, any>) => {
    const { people: who, ...r } = form;
    const common = nullify({ location_name: r.location_name, address: r.address, reservation_details: r.reservation_details, description: r.description, notes: r.notes, status: r.status, is_optional: r.is_optional, reminder_minutes: r.reminder_minutes === '' ? null : Number(r.reminder_minutes) });
    const own = linked ? {} : nullify({ title: r.title.trim(), event_day_id: r.event_day_id, is_all_day: r.is_all_day, start_time: r.is_all_day ? '' : r.start_time, end_time: r.is_all_day ? '' : r.end_time, category: r.category, confirmation_number: r.confirmation_number });
    const ok = await run(async () => {
      let id = item?.id;
      if (item) await saveVersioned('itinerary_items', item, { ...own, ...common });
      else id = (await insertRow('itinerary_items', { event_id: b.event.id, position: Date.now() / 1000, ...own, ...common })).id;
      await setPeople('activity_participants', 'item_id', id!, b.event.id, who);
      return true;
    }, item ? 'Saved' : 'Added');
    if (ok) onClose();
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={item ? (linked ? 'Add details' : 'Edit activity') : 'New activity'}>
      <SimpleForm fields={fields} defaults={initial} submitLabel={item ? 'Save changes' : 'Add activity'} onSubmit={submit}
        refine={(x) => (x.start_time && x.end_time && x.end_time < x.start_time ? { path: 'end_time', message: 'End must be after start' } : null)} />
    </Sheet>
  );
}
const SOURCE: Record<string, { path: string; label: string; param: (i: ItineraryItem) => string | null }> = {
  travel: { path: 'travel', label: 'travel', param: (i) => i.travel_segment_id }, accommodation: { path: 'stay', label: 'stay', param: (i) => i.accommodation_id }, competition: { path: 'competition', label: 'session', param: (i) => i.competition_session_id },
};
export function ActivityDetailSheet({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const ctx = useEvent();
  const { b, canEdit, run, personName, editItem, peopleOf } = ctx;
  const nav = useNavigate();
  const item = b.items.find((i) => i.id === itemId);
  const [panel, setPanel] = React.useState<null | 'time' | 'note' | 'move'>(null);
  const [start, setStart] = React.useState(''); const [end, setEnd] = React.useState(''); const [note, setNote] = React.useState(''); const [comment, setComment] = React.useState('');
  React.useEffect(() => { setStart(hhmm(item?.start_time)); setEnd(hhmm(item?.end_time)); }, [item?.start_time, item?.end_time]);
  if (!item) return null;
  const day = b.days.find((d) => d.id === item.event_day_id);
  const docs = b.documents.filter((d) => d.itinerary_item_id === item.id);
  const comments = b.comments.filter((c) => c.itinerary_item_id === item.id);
  const who = peopleOf(item.id);
  const linked = item.source_type ? SOURCE[item.source_type] : null;
  const goSource = () => { onClose(); nav(`/events/${b.event.id}/${linked!.path}?edit=${linked!.param(item)}`); };
  const place = item.address || item.location_name;
  const done = item.status === 'completed';
  const dayItems = sortItems(b.items.filter((i) => i.event_day_id === item.event_day_id));
  const idx = dayItems.findIndex((i) => i.id === item.id);
  const shift = (delta: number) => { const a = [...dayItems]; const [x] = a.splice(idx, 1); a.splice(idx + delta, 0, x); return run(() => rpc('move_itinerary_item', { p_item: item.id, p_day: item.event_day_id, p_ordered: a.map((i) => i.id) })); };
  const remove = async () => { if (await confirmDialog({ title: `Delete "${item.title}"?`, body: 'This removes it for everyone.', action: 'Delete', destructive: true })) { const ok = await run(() => deleteRow('itinerary_items', item.id).then(() => true), 'Deleted'); if (ok) onClose(); } };
  const duplicate = () => run(() => insertRow('itinerary_items', { event_id: item.event_id, event_day_id: item.event_day_id, title: `${item.title} (copy)`.slice(0, 200), description: item.description, start_time: item.start_time, end_time: item.end_time, is_all_day: item.is_all_day, location_name: item.location_name, address: item.address, category: item.category, notes: item.notes, is_optional: item.is_optional, position: item.position + 1 }), 'Duplicated');
  const row = (Icon: typeof Clock, text: React.ReactNode) => <div className="flex gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" aria-hidden /><div className="min-w-0">{text}</div></div>;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={item.title}>
      <div className="space-y-4 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {done && <Badge tone="teal">Completed</Badge>}{item.status === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}{item.status === 'confirmed' && <Badge tone="teal">Confirmed</Badge>}{item.is_optional && <Badge tone="gold">Optional</Badge>}{linked && <Badge><Link2 className="h-3 w-3" />From {linked.label}</Badge>}
        </div>
        <div className="space-y-3">
          {row(Clock, <>{day ? formatDayLong(day.day_date) : 'Ideas (no date yet)'}<div className="text-ink-soft">{item.is_all_day ? 'All day' : item.start_time ? `${formatTime(item.start_time)}${item.end_time ? ` to ${formatTime(item.end_time)}` : ''}` : 'No set time'}</div></>)}
          {place && row(MapPin, <>{item.location_name}{item.address && <div className="text-ink-soft">{item.address}</div>}</>)}
        </div>
        {who.length > 0 && <div className="flex flex-wrap gap-2">{who.map((n) => <span key={n} className="flex items-center gap-1.5 rounded-full bg-card py-1 pl-1 pr-3 text-[15px] shadow-soft"><Avatar name={n} size={26} />{n}</span>)}</div>}
        {item.confirmation_number && <button onClick={async () => { await copyText(item.confirmation_number!); toast.success('Confirmation number copied'); }} className="ticket block w-full p-4 text-left"><span className="text-sm text-ink-soft">Confirmation (tap to copy)</span><div className="font-display text-2xl font-semibold tracking-wide">{item.confirmation_number}</div></button>}
        {item.reservation_details && <p className="whitespace-pre-wrap">{item.reservation_details}</p>}
        {item.description && <p className="whitespace-pre-wrap text-ink-soft">{item.description}</p>}
        {item.notes && <div className="rounded-2xl bg-gold-soft p-3.5 whitespace-pre-wrap">{item.notes}</div>}

        <div className="grid grid-cols-2 gap-2">
          {place && <Button className="col-span-2" size="lg" onClick={() => openMaps(item.address || item.location_name!)}><Navigation className="h-5 w-5" />Open in Maps</Button>}
          {canEdit && <Button variant="soft" onClick={() => run(() => saveVersioned('itinerary_items', item, { status: done ? 'planned' : 'completed' }).then(() => true), done ? 'Marked not done' : 'Marked complete')}><Check className="h-5 w-5" />{done ? 'Not done' : 'Complete'}</Button>}
          {canEdit && <Button variant="soft" onClick={() => (linked ? goSource() : setPanel(panel === 'time' ? null : 'time'))}><Clock className="h-5 w-5" />Change time</Button>}
          {canEdit && <Button variant="soft" onClick={() => setPanel(panel === 'note' ? null : 'note')}><Pencil className="h-5 w-5" />Add note</Button>}
          {canEdit && !linked && <Button variant="soft" onClick={() => setPanel(panel === 'move' ? null : 'move')}><Copy className="h-5 w-5 rotate-90" />Move</Button>}
          {canEdit && <UploadButton variant="soft" eventId={b.event.id} link={{ itinerary_item_id: item.id }} label="Attach" icon={<Paperclip className="h-5 w-5" />} />}
        </div>

        {panel === 'time' && <form className="space-y-3 rounded-2xl bg-card p-3.5 shadow-soft" onSubmit={async (e) => { e.preventDefault(); if (end && start && end < start) { toast.error('End must be after start'); return; } const ok = await run(() => saveVersioned('itinerary_items', item, { start_time: start || null, end_time: end || null, is_all_day: false }).then(() => true), 'Time changed'); if (ok) setPanel(null); }}>
          <div className="grid grid-cols-2 gap-3"><Field label="Start" htmlFor="qs"><Input id="qs" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field><Field label="End" htmlFor="qe"><Input id="qe" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field></div>
          <Button type="submit" className="w-full">Save time</Button></form>}
        {panel === 'note' && <form className="space-y-3 rounded-2xl bg-card p-3.5 shadow-soft" onSubmit={async (e) => { e.preventDefault(); if (!note.trim()) return; const ok = await run(() => saveVersioned('itinerary_items', item, { notes: [item.notes, note.trim()].filter(Boolean).join('\n') }).then(() => true), 'Note added'); if (ok) { setNote(''); setPanel(null); } }}>
          <Field label="Note" htmlFor="qn2"><Textarea id="qn2" value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></Field><Button type="submit" className="w-full">Add note</Button></form>}
        {panel === 'move' && <div className="space-y-3 rounded-2xl bg-card p-3.5 shadow-soft">
          <Field label="Move to" htmlFor="mv"><Select id="mv" value={item.event_day_id ?? ''} onChange={(e) => { const d = e.target.value || null; const ids = [...b.items.filter((i) => i.event_day_id === d).map((i) => i.id), item.id]; void run(() => rpc('move_itinerary_item', { p_item: item.id, p_day: d, p_ordered: ids }), 'Moved'); }}>{b.days.map((d) => <option key={d.id} value={d.id}>{formatDayShort(d.day_date)}</option>)}<option value="">Ideas</option></Select></Field>
          {!item.start_time && day && <div className="grid grid-cols-2 gap-2"><Button variant="soft" disabled={idx <= 0} onClick={() => shift(-1)}><ChevronUp className="h-5 w-5" />Earlier</Button><Button variant="soft" disabled={idx === dayItems.length - 1} onClick={() => shift(1)}><ChevronDown className="h-5 w-5" />Later</Button></div>}
        </div>}
        {docs.length > 0 && <DocList docs={docs} />}
        {canEdit && <div className="grid grid-cols-2 gap-2">
          {linked ? <Button className="col-span-2" variant="outline" onClick={goSource}>Edit {linked.label} details</Button> : <><Button variant="outline" onClick={() => editItem(item)}><Pencil className="h-4 w-4" />Edit</Button><Button variant="outline" onClick={duplicate}><Copy className="h-4 w-4" />Duplicate</Button></>}
          {linked && <Button className="col-span-2" variant="ghost" onClick={() => editItem(item)}>Add location, people, or notes</Button>}
          {!linked && <Button className="col-span-2" variant="dangerSoft" onClick={remove}><Trash2 className="h-4 w-4" />Delete</Button>}
        </div>}
        <section aria-label="Comments" className="space-y-2.5">
          <h3 className="font-display text-lg font-semibold">Comments</h3>
          {comments.map((c) => <div key={c.id} className="flex gap-2.5"><Avatar name={personName(c.created_by)} size={30} /><div className="min-w-0"><div className="text-sm text-ink-soft">{personName(c.created_by)}, {timeAgo(c.created_at)}</div><p className="whitespace-pre-wrap">{c.body}</p></div></div>)}
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!comment.trim()) return; const ok = await run(() => insertRow('comments', { event_id: b.event.id, itinerary_item_id: item.id, body: comment.trim(), created_by: ctx.userId })); if (ok) setComment(''); }}>
            <Input aria-label="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment" /><Button type="submit" size="icon" aria-label="Send comment" className="h-12 w-12 shrink-0"><Send className="h-5 w-5" /></Button>
          </form>
        </section>
        <UpdatedBy item={item} name={personName(item.updated_by ?? item.created_by)} />
      </div>
    </Sheet>
  );
}
const UpdatedBy = ({ item, name }: { item: ItineraryItem; name: string }) => <p className="text-sm text-ink-soft">Last changed by {name}, {timeAgo(item.updated_at)}</p>;
