import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, CopyPlus, ImagePlus, Trash2 } from 'lucide-react';
import { CoverArt, sceneKeys } from '@/components/CoverArt';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Card, Field, Input } from '@/components/ui/misc';
import { SimpleForm, type FieldDef } from '@/components/SimpleForm';
import { confirmDialog } from '@/components/ui/confirm';
import { rpc, saveVersioned, updateRow, deleteRow, uploadCover } from '@/data/api';
import { addDays, commonTimeZones } from '@/domain/time';
import { cn, nullify } from '@/lib/utils';
import type { ModuleKey } from '@/domain/types';
import { MODULES, MODULE_ORDER } from './modules';
import { useEvent } from './EventContext';

export function SettingsPage() {
  const { b, canEdit, run, today } = useEvent();
  const e = b.event; const nav = useNavigate();
  const [dup, setDup] = React.useState(false); const [title, setTitle] = React.useState(`${e.title} (copy)`); const [start, setStart] = React.useState(addDays(today, 30));
  const fileRef = React.useRef<HTMLInputElement>(null);
  if (!canEdit) return <div className="mx-auto max-w-2xl p-6"><h2 className="font-display text-[26px] font-bold">Settings</h2><p className="mt-2 text-ink-soft">Only editors can change event settings.</p></div>;
  const zones = commonTimeZones.includes(e.timezone) ? commonTimeZones : [e.timezone, ...commonTimeZones];
  const fields: FieldDef[] = [{ name: 'title', label: 'Event title', required: true }, { name: 'start_date', label: 'Start', type: 'date', required: true, half: true }, { name: 'end_date', label: 'End', type: 'date', required: true, half: true }, { name: 'destination', label: 'Destination' }, { name: 'primary_venue', label: 'Primary venue' }, { name: 'timezone', label: 'Time zone', type: 'select', options: zones.map((z) => ({ value: z, label: z.replace(/_/g, ' ') })) }, { name: 'visibility', label: 'Who can see this', type: 'select', options: [{ value: 'workspace', label: 'Everyone in the family' }, { value: 'private', label: 'Only people added to this event' }] }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'notes', label: 'Notes', type: 'textarea' }];
  const setMods = (patch: { modules?: ModuleKey[]; pinned_modules?: ModuleKey[] }) => run(() => saveVersioned('events', e, patch).then(() => true));
  const togglePin = (k: ModuleKey) => { const on = e.pinned_modules.includes(k); if (!on && e.pinned_modules.length >= 3) return void setMods({ pinned_modules: [...e.pinned_modules.slice(1), k] }); void setMods({ pinned_modules: on ? e.pinned_modules.filter((x) => x !== k) : [...e.pinned_modules, k] }); };
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
      <h2 className="font-display text-[26px] font-bold">Event settings</h2>
      <section><h3 className="mb-2 font-display text-lg font-semibold">Cover</h3>
        <div className="relative h-40 overflow-hidden rounded-2xl"><CoverArt scene={e.cover_scene} path={e.cover_path} /></div>
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto py-1">{sceneKeys.map((s) => <button key={s} aria-label={`Use ${s} scene`} aria-pressed={!e.cover_path && e.cover_scene === s} onClick={() => run(() => saveVersioned('events', e, { cover_scene: s, cover_path: null }).then(() => true))} className={cn('h-14 w-20 shrink-0 overflow-hidden rounded-xl', !e.cover_path && e.cover_scene === s && 'ring-2 ring-teal ring-offset-2')}><CoverArt scene={s} /></button>)}</div>
        <input ref={fileRef} type="file" accept="image/*" hidden aria-label="Choose cover photo" onChange={async (ev) => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) await run(async () => { const path = await uploadCover(e.id, f); await saveVersioned('events', e, { cover_path: path }); return true; }, 'Cover updated'); }} />
        <Button variant="soft" className="mt-2" onClick={() => fileRef.current?.click()}><ImagePlus className="h-5 w-5" />Upload a photo</Button>
      </section>
      <section><h3 className="mb-2 font-display text-lg font-semibold">Details</h3><Card className="p-4">
        <SimpleForm key={e.version} fields={fields} submitLabel="Save changes" refine={(v) => (v.end_date < v.start_date ? { path: 'end_date', message: 'End must be on or after start' } : null)} defaults={{ title: e.title, start_date: e.start_date, end_date: e.end_date, destination: e.destination ?? '', primary_venue: e.primary_venue ?? '', timezone: e.timezone, visibility: e.visibility, description: e.description ?? '', notes: e.notes ?? '' }}
          onSubmit={async (v) => { if ((v.start_date > e.start_date || v.end_date < e.end_date) && !(await confirmDialog({ title: 'Shorten this event?', body: 'Activities on removed days move to Ideas. Nothing is deleted.', action: 'Shorten event' }))) return; await run(() => saveVersioned('events', e, nullify(v)).then(() => true), 'Saved'); }} />
      </Card></section>
      <section><h3 className="mb-1 font-display text-lg font-semibold">Sections</h3><p className="mb-2 text-ink-soft">Turn sections on or off. Pin up to three for the bottom bar.</p>
        <ul className="overflow-hidden rounded-2xl bg-card shadow-soft">{MODULE_ORDER.map((k) => { const M = MODULES[k]; const on = e.modules.includes(k) || !M.optional; const pinned = e.pinned_modules.includes(k); return <li key={k} className="flex min-h-14 items-center gap-3 border-b border-line px-3.5 last:border-0"><M.icon className="h-5 w-5 text-teal" aria-hidden /><label className="flex flex-1 items-center justify-between gap-3 font-medium">{M.label}{M.optional && <input type="checkbox" className="h-6 w-6 accent-teal" checked={on} onChange={() => setMods(on ? { modules: e.modules.filter((x) => x !== k), pinned_modules: e.pinned_modules.filter((x) => x !== k) } : { modules: [...e.modules, k] })} />}</label>{on && <Button size="sm" variant={pinned ? 'primary' : 'soft'} aria-pressed={pinned} onClick={() => togglePin(k)}>{pinned ? 'Pinned' : 'Pin'}</Button>}</li>; })}</ul>
      </section>
      <section className="space-y-2">
        <Button variant="soft" className="w-full" onClick={() => setDup(true)}><CopyPlus className="h-5 w-5" />Duplicate event</Button>
        <Button variant="soft" className="w-full" onClick={() => run(() => updateRow('events', e.id, { archived_at: e.archived_at ? null : new Date().toISOString() }).then(() => true), e.archived_at ? 'Restored' : 'Archived')}><Archive className="h-5 w-5" />{e.archived_at ? 'Restore from archive' : 'Archive event'}</Button>
        {b.myRole === 'owner' && <Button variant="dangerSoft" className="w-full" onClick={async () => { if (await confirmDialog({ title: `Delete ${e.title}?`, body: 'This permanently removes the event and everything in it for everyone. Archive it to keep a record.', action: 'Delete forever', destructive: true })) { const ok = await run(() => deleteRow('events', e.id).then(() => true), 'Event deleted'); if (ok) nav('/'); } }}><Trash2 className="h-5 w-5" />Delete event</Button>}
      </section>
      {dup && <Sheet open onOpenChange={setDup} title="Duplicate event"><form className="space-y-4 pb-3" onSubmit={async (ev) => { ev.preventDefault(); const id = await run(() => rpc<string>('duplicate_event', { p_event: e.id, p_title: title, p_start: start }), 'Event duplicated'); if (id) { setDup(false); nav(`/events/${id}`); } }}><p className="text-ink-soft">Copies activities, packing lists, lists, tasks, and notes. Flights, hotels, sessions, and documents are left out because bookings don't carry over.</p><Field label="New title" htmlFor="dt"><Input id="dt" required value={title} onChange={(x) => setTitle(x.target.value)} /></Field><Field label="New start date" htmlFor="ds"><Input id="ds" type="date" required value={start} onChange={(x) => setStart(x.target.value)} /></Field><Button type="submit" size="lg" className="w-full">Duplicate event</Button></form></Sheet>}
    </div>
  );
}
