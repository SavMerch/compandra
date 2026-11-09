// Travel, Stay, and Sessions: domain records that feed the agenda through database triggers.
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { BedDouble, Car, Copy, FileText, MapPin, Navigation, Pencil, Phone, Plane, Plus, Train, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Badge, Card, EmptyState } from '@/components/ui/misc';
import { SimpleForm, type FieldDef } from '@/components/SimpleForm';
import { confirmDialog } from '@/components/ui/confirm';
import { deleteRow, insertRow, saveVersioned, setPeople } from '@/data/api';
import { formatDayLong, formatLocalStamp, formatTime, hhmm, toLocalInput } from '@/domain/time';
import { copyText, openExternal, openMaps } from '@/lib/platform';
import { nullify } from '@/lib/utils';
import { useEvent } from '../event/EventContext';
import { DocList, UploadButton } from './Documents';
import type { Accommodation, CompetitionSession, DocumentRow, TravelSegment } from '@/domain/types';

function useEditor<T extends { id: string }>(rows: T[]) {
  const [sp, setSp] = useSearchParams();
  const [form, setForm] = React.useState<{ row?: T } | null>(null);
  const edit = sp.get('edit');
  React.useEffect(() => { if (edit) { const row = rows.find((r) => r.id === edit); if (row) setForm({ row }); setSp({}, { replace: true }); } }, [edit, rows, setSp]);
  return { form, setForm, close: () => setForm(null) };
}
const Head = ({ title, label, onAdd }: { title: string; label: string; onAdd?: () => void }) => <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-[26px] font-bold">{title}</h2>{onAdd && <Button onClick={onAdd}><Plus className="h-5 w-5" />{label}</Button>}</div>;
const Fact = ({ k, v }: { k: string; v?: string | null }) => (v ? <div className="min-w-0"><dt className="text-sm text-ink-soft">{k}</dt><dd className="break-words font-medium">{v}</dd></div> : null);
const CopyConf = ({ v }: { v?: string | null }) => (v ? <button onClick={async () => { await copyText(v); toast.success('Confirmation number copied'); }} className="flex min-h-11 items-center gap-2 font-display text-xl font-semibold tracking-wide"><Copy className="h-4 w-4 text-ink-soft" aria-label="Copy" />{v}</button> : null);
const del = async (run: ReturnType<typeof useEvent>['run'], table: string, id: string, what: string, close: () => void) => { if (await confirmDialog({ title: `Delete this ${what}?`, body: 'It is also removed from the agenda.', action: 'Delete', destructive: true })) { const ok = await run(() => deleteRow(table, id).then(() => true), 'Deleted'); if (ok) close(); } };
const Docs = ({ docs, canEdit, eventId, link }: { docs: DocumentRow[]; canEdit: boolean; eventId: string; link: Parameters<typeof UploadButton>[0]['link'] }) => <div className="space-y-2">{docs.length > 0 && <DocList docs={docs} />}{canEdit && <UploadButton variant="outline" eventId={eventId} link={link} label="Attach file" icon={<FileText className="h-4 w-4" />} />}</div>;

// ─── Travel ───
const modes = [{ value: 'flight', label: 'Flight' }, { value: 'rental_car', label: 'Rental car' }, { value: 'personal_vehicle', label: 'Personal vehicle' }, { value: 'train', label: 'Train' }, { value: 'shuttle', label: 'Shuttle' }, { value: 'other', label: 'Other' }];
const isFlight = (v: any) => v.mode === 'flight', isGround = (v: any) => v.mode !== 'flight';
export function TravelPage() {
  const { b, canEdit, run, people } = useEvent();
  const { form, setForm, close } = useEditor(b.travel);
  const row = form?.row;
  const fields: FieldDef[] = [
    { name: 'mode', label: 'Type', type: 'select', options: modes, half: true }, { name: 'direction', label: 'Leg', type: 'select', half: true, options: [{ value: 'outbound', label: 'Outbound' }, { value: 'return', label: 'Return' }, { value: 'connecting', label: 'Connecting' }, { value: 'other', label: 'Other' }] },
    { name: 'carrier', label: 'Airline or company', half: true }, { name: 'flight_number', label: 'Flight or train number', half: true, show: (v) => v.mode === 'flight' || v.mode === 'train' },
    { name: 'origin', label: 'From', half: true, placeholder: 'ATL' }, { name: 'destination', label: 'To', half: true, placeholder: 'MCO' },
    { name: 'depart_local', label: 'Departs (local time)', type: 'datetime', required: true }, { name: 'arrive_local', label: 'Arrives (local time)', type: 'datetime' },
    { name: 'confirmation_number', label: 'Confirmation number' }, { name: 'travelers', label: 'Travelers', type: 'people', people },
    { name: 'seats', label: 'Seats', half: true, show: isFlight }, { name: 'terminal', label: 'Terminal', half: true, show: isFlight }, { name: 'gate', label: 'Gate', half: true, show: isFlight },
    { name: 'pickup_location', label: 'Pickup location', show: isGround }, { name: 'dropoff_location', label: 'Drop-off location', show: isGround }, { name: 'parking_info', label: 'Parking', show: isGround }, { name: 'notes', label: 'Notes', type: 'textarea' },
  ];
  const noon = `${b.event.start_date}T09:00`;
  const defaults = { mode: row?.mode ?? 'flight', direction: row?.direction ?? 'outbound', carrier: row?.carrier ?? '', flight_number: row?.flight_number ?? '', origin: row?.origin ?? '', destination: row?.destination ?? '', depart_local: row ? toLocalInput(row.depart_local) : noon, arrive_local: toLocalInput(row?.arrive_local), confirmation_number: row?.confirmation_number ?? '', seats: row?.seats ?? '', terminal: row?.terminal ?? '', gate: row?.gate ?? '', pickup_location: row?.pickup_location ?? '', dropoff_location: row?.dropoff_location ?? '', parking_info: row?.parking_info ?? '', notes: row?.notes ?? '', travelers: row ? b.travelers.filter((t) => t.segment_id === row.id).map((t) => t.participant_id) : [] };
  const submit = async ({ travelers, ...r }: Record<string, any>) => { const ok = await run(async () => { const p = nullify({ ...r, depart_tz: b.event.timezone, arrive_tz: b.event.timezone }); let id = row?.id; if (row) await saveVersioned('travel_segments', row, p); else id = (await insertRow('travel_segments', { event_id: b.event.id, ...p })).id; await setPeople('travel_segment_travelers', 'segment_id', id!, b.event.id, travelers); return true; }, row ? 'Saved. Agenda updated.' : 'Added to the agenda'); if (ok) close(); };
  return (
    <div className="mx-auto max-w-2xl p-4 lg:p-6">
      <Head title="Travel" label="Add" onAdd={canEdit ? () => setForm({}) : undefined} />
      {!b.travel.length && <EmptyState icon={Plane} title="No travel yet" body="Add a flight, rental car, or drive. It shows up on the agenda automatically." />}
      <div className="space-y-3">{b.travel.map((t) => <TravelCard key={t.id} t={t} onEdit={() => setForm({ row: t })} />)}</div>
      {form && <Sheet open onOpenChange={(o) => !o && close()} title={row ? 'Edit travel' : 'Add travel'}><SimpleForm fields={fields} defaults={defaults} submitLabel={row ? 'Save changes' : 'Add travel'} onSubmit={submit} onDelete={row ? () => del(run, 'travel_segments', row.id, 'travel', close) : undefined} refine={(v) => (v.arrive_local && v.arrive_local < v.depart_local ? { path: 'arrive_local', message: 'Arrival must be after departure' } : null)} /></Sheet>}
    </div>
  );
}
export function TravelCard({ t, onEdit, pass }: { t: TravelSegment; onEdit?: () => void; pass?: boolean }) {
  const { b, canEdit } = useEvent();
  const I = t.mode === 'flight' ? Plane : t.mode === 'train' ? Train : Car;
  const who = b.travelers.filter((x) => x.segment_id === t.id).map((x) => b.participants.find((p) => p.id === x.participant_id)?.display_name).filter(Boolean).join(', ');
  const docs = b.documents.filter((d) => d.travel_segment_id === t.id);
  return (
    <div className="ticket">
      <div className="p-4">
        <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 font-semibold"><I className="h-5 w-5 text-teal" aria-hidden />{[t.carrier, t.flight_number].filter(Boolean).join(' ') || modes.find((m) => m.value === t.mode)?.label}</span><Badge className="capitalize">{t.direction}</Badge></div>
        {(t.origin || t.destination) && <div className="mt-2 font-display text-[28px] font-bold leading-tight">{t.origin}{t.destination ? ` to ${t.destination}` : ''}</div>}
        <p className="text-ink-soft">{formatLocalStamp(t.depart_local)}{t.arrive_local ? `, arrives ${formatLocalStamp(t.arrive_local)}` : ''}</p>
      </div>
      {(t.confirmation_number || t.seats || t.terminal || t.gate || who || t.pickup_location || t.parking_info || t.notes) && <><div className="ticket-perf" /><div className="p-4"><CopyConf v={t.confirmation_number} /><dl className="mt-1 grid grid-cols-2 gap-3"><Fact k="Travelers" v={who} /><Fact k="Seats" v={t.seats} /><Fact k="Terminal" v={t.terminal} /><Fact k="Gate" v={t.gate} /><Fact k="Pickup" v={t.pickup_location} /><Fact k="Drop-off" v={t.dropoff_location} /><Fact k="Parking" v={t.parking_info} /><Fact k="Notes" v={t.notes} /></dl></div></>}
      {!pass && <div className="flex flex-wrap items-start gap-2 px-4 pb-4"><Docs docs={docs} canEdit={canEdit} eventId={t.event_id} link={{ travel_segment_id: t.id }} />{canEdit && onEdit && <Button variant="soft" onClick={onEdit}><Pencil className="h-4 w-4" />Edit</Button>}</div>}
      {pass && docs.length > 0 && <div className="px-4 pb-4"><DocList docs={docs} /></div>}
    </div>
  );
}
// ─── Stay ───
export function StayPage() {
  const { b, canEdit, run, people } = useEvent();
  const { form, setForm, close } = useEditor(b.stays);
  const row = form?.row;
  const fields: FieldDef[] = [
    { name: 'name', label: 'Property name', required: true }, { name: 'address', label: 'Address' },
    { name: 'check_in_local', label: 'Check-in', type: 'datetime', required: true }, { name: 'check_out_local', label: 'Checkout', type: 'datetime', required: true },
    { name: 'confirmation_number', label: 'Confirmation number' }, { name: 'room_info', label: 'Room' }, { name: 'guests', label: 'Guests', type: 'people', people },
    { name: 'phone', label: 'Phone', type: 'tel', half: true }, { name: 'email', label: 'Email', type: 'email', half: true }, { name: 'parking', label: 'Parking' }, { name: 'special_instructions', label: 'Special instructions', type: 'textarea' }, { name: 'notes', label: 'Notes', type: 'textarea' },
  ];
  const defaults = { name: row?.name ?? '', address: row?.address ?? '', check_in_local: row ? toLocalInput(row.check_in_local) : `${b.event.start_date}T15:00`, check_out_local: row ? toLocalInput(row.check_out_local) : `${b.event.end_date}T11:00`, confirmation_number: row?.confirmation_number ?? '', room_info: row?.room_info ?? '', phone: row?.phone ?? '', email: row?.email ?? '', parking: row?.parking ?? '', special_instructions: row?.special_instructions ?? '', notes: row?.notes ?? '', guests: row ? b.guests.filter((g) => g.accommodation_id === row.id).map((g) => g.participant_id) : [] };
  const submit = async ({ guests, ...r }: Record<string, any>) => { const ok = await run(async () => { const p = nullify(r); let id = row?.id; if (row) await saveVersioned('accommodations', row, p); else id = (await insertRow('accommodations', { event_id: b.event.id, ...p })).id; await setPeople('accommodation_guests', 'accommodation_id', id!, b.event.id, guests); return true; }, row ? 'Saved. Agenda updated.' : 'Check-in and checkout added to the agenda'); if (ok) close(); };
  return (
    <div className="mx-auto max-w-2xl p-4 lg:p-6">
      <Head title="Stay" label="Add" onAdd={canEdit ? () => setForm({}) : undefined} />
      {!b.stays.length && <EmptyState icon={BedDouble} title="No stays yet" body="Add a hotel or rental. Check-in and checkout appear on the agenda." />}
      <div className="space-y-3">{b.stays.map((s) => <StayCard key={s.id} s={s} onEdit={() => setForm({ row: s })} />)}</div>
      {form && <Sheet open onOpenChange={(o) => !o && close()} title={row ? 'Edit stay' : 'Add stay'}><SimpleForm fields={fields} defaults={defaults} submitLabel={row ? 'Save changes' : 'Add stay'} onSubmit={submit} onDelete={row ? () => del(run, 'accommodations', row.id, 'stay', close) : undefined} refine={(v) => (v.check_out_local < v.check_in_local ? { path: 'check_out_local', message: 'Checkout must be after check-in' } : null)} /></Sheet>}
    </div>
  );
}
export function StayCard({ s, onEdit, pass }: { s: Accommodation; onEdit?: () => void; pass?: boolean }) {
  const { b, canEdit } = useEvent();
  const who = b.guests.filter((x) => x.accommodation_id === s.id).map((x) => b.participants.find((p) => p.id === x.participant_id)?.display_name).filter(Boolean).join(', ');
  const docs = b.documents.filter((d) => d.accommodation_id === s.id);
  return (
    <div className="ticket">
      <div className="p-4"><div className="font-display text-[24px] font-bold leading-tight">{s.name}</div>{s.address && <p className="text-ink-soft">{s.address}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {s.address && <Button size="sm" onClick={() => openMaps(s.address!)}><Navigation className="h-4 w-4" />Directions</Button>}
          {s.phone && <Button size="sm" variant="soft" onClick={() => openExternal(`tel:${s.phone}`)}><Phone className="h-4 w-4" />Call</Button>}
          {s.address && <Button size="sm" variant="soft" onClick={async () => { await copyText(s.address!); toast.success('Address copied'); }}><MapPin className="h-4 w-4" />Copy address</Button>}
        </div>
      </div>
      <div className="ticket-perf" />
      <div className="p-4"><CopyConf v={s.confirmation_number} /><dl className="mt-1 grid grid-cols-2 gap-3"><Fact k="Check-in" v={formatLocalStamp(s.check_in_local)} /><Fact k="Checkout" v={formatLocalStamp(s.check_out_local)} /><Fact k="Room" v={s.room_info} /><Fact k="Guests" v={who} /><Fact k="Parking" v={s.parking} /><Fact k="Email" v={s.email} /><Fact k="Instructions" v={s.special_instructions} /><Fact k="Notes" v={s.notes} /></dl></div>
      {!pass && <div className="flex flex-wrap items-start gap-2 px-4 pb-4"><Docs docs={docs} canEdit={canEdit} eventId={s.event_id} link={{ accommodation_id: s.id }} />{canEdit && onEdit && <Button variant="soft" onClick={onEdit}><Pencil className="h-4 w-4" />Edit</Button>}</div>}
      {pass && docs.length > 0 && <div className="px-4 pb-4"><DocList docs={docs} /></div>}
    </div>
  );
}
// ─── Sessions ───
export function CompetitionPage() {
  const { b, canEdit, run, people, today } = useEvent();
  const { form, setForm, close } = useEditor(b.sessions);
  const row = form?.row;
  const fields: FieldDef[] = [
    { name: 'kind', label: 'Kind', type: 'select', options: [{ value: 'competition', label: 'Competition' }, { value: 'performance', label: 'Performance' }, { value: 'conference', label: 'Conference' }, { value: 'other', label: 'Other' }] },
    { name: 'name', label: 'Name', required: true, placeholder: 'State Championships' }, { name: 'session_label', label: 'Session', half: true, placeholder: 'Session 2' }, { name: 'session_date', label: 'Date', type: 'date', required: true, half: true },
    { name: 'check_in_time', label: 'Check-in', type: 'time', half: true }, { name: 'warmup_time', label: 'Warm-up', type: 'time', half: true }, { name: 'start_time', label: 'Start', type: 'time', half: true }, { name: 'end_time', label: 'End', type: 'time', half: true },
    { name: 'people', label: 'Who is taking part', type: 'people', people }, { name: 'venue', label: 'Venue' }, { name: 'address', label: 'Address' }, { name: 'organizer', label: 'Organizer' }, { name: 'division', label: 'Division', half: true }, { name: 'category', label: 'Category', half: true }, { name: 'equipment', label: 'What to bring', type: 'textarea' }, { name: 'notes', label: 'Notes', type: 'textarea' },
  ];
  const last = b.sessions[b.sessions.length - 1];
  const defaults = { kind: row?.kind ?? 'competition', name: row?.name ?? last?.name ?? '', session_label: row?.session_label ?? '', session_date: row?.session_date ?? (today >= b.event.start_date && today <= b.event.end_date ? today : b.event.start_date), check_in_time: hhmm(row?.check_in_time), warmup_time: hhmm(row?.warmup_time), start_time: hhmm(row?.start_time), end_time: hhmm(row?.end_time), venue: row?.venue ?? last?.venue ?? b.event.primary_venue ?? '', address: row?.address ?? last?.address ?? '', organizer: row?.organizer ?? last?.organizer ?? '', division: row?.division ?? '', category: row?.category ?? '', equipment: row?.equipment ?? '', notes: row?.notes ?? '', people: row ? b.sessionPeople.filter((p) => p.session_id === row.id).map((p) => p.participant_id) : [] };
  const submit = async ({ people: who, ...r }: Record<string, any>) => { const ok = await run(async () => { const p = nullify(r); let id = row?.id; if (row) await saveVersioned('competition_sessions', row, p); else id = (await insertRow('competition_sessions', { event_id: b.event.id, ...p })).id; await setPeople('competition_session_participants', 'session_id', id!, b.event.id, who); return true; }, row ? 'Saved. Agenda updated.' : 'Added to the agenda'); if (ok) close(); };
  const dates = [...new Set(b.sessions.map((s) => s.session_date))];
  return (
    <div className="mx-auto max-w-2xl p-4 lg:p-6">
      <Head title="Sessions" label="Add" onAdd={canEdit ? () => setForm({}) : undefined} />
      {!b.sessions.length && <EmptyState icon={Trophy} title="No sessions yet" body="Add competition sessions, performances, or talks. They appear on the agenda." />}
      <div className="space-y-6">{dates.map((d) => <section key={d}><h3 className="mb-2 font-display text-xl font-semibold">{formatDayLong(d)}</h3><div className="space-y-3">{b.sessions.filter((s) => s.session_date === d).sort((x, y) => (x.start_time ?? '').localeCompare(y.start_time ?? '')).map((s) => <SessionCard key={s.id} s={s} onEdit={() => setForm({ row: s })} />)}</div></section>)}</div>
      {form && <Sheet open onOpenChange={(o) => !o && close()} title={row ? 'Edit session' : 'Add session'}><SimpleForm fields={fields} defaults={defaults} submitLabel={row ? 'Save changes' : 'Add session'} onSubmit={submit} onDelete={row ? () => del(run, 'competition_sessions', row.id, 'session', close) : undefined} refine={(v) => (v.session_date < b.event.start_date || v.session_date > b.event.end_date ? { path: 'session_date', message: 'Pick a date within the event' } : null)} /></Sheet>}
    </div>
  );
}
function SessionCard({ s, onEdit }: { s: CompetitionSession; onEdit: () => void }) {
  const { b, canEdit } = useEvent();
  const who = b.sessionPeople.filter((x) => x.session_id === s.id).map((x) => b.participants.find((p) => p.id === x.participant_id)?.display_name).filter(Boolean).join(', ');
  const docs = b.documents.filter((d) => d.competition_session_id === s.id);
  const place = s.address || s.venue;
  return (
    <div className="ticket">
      <div className="p-4"><div className="font-display text-[22px] font-bold leading-tight">{[s.session_label, who].filter(Boolean).join(': ') || s.name}</div><p className="text-ink-soft">{[s.name, s.venue].filter(Boolean).join(' at ')}</p>
        <dl className="mt-3 grid grid-cols-3 gap-2"><Fact k="Check-in" v={formatTime(s.check_in_time)} /><Fact k="Warm-up" v={formatTime(s.warmup_time)} /><Fact k="Start" v={formatTime(s.start_time)} /></dl>
      </div>
      {(s.division || s.category || s.equipment || s.organizer || s.notes) && <><div className="ticket-perf" /><dl className="grid grid-cols-2 gap-3 p-4"><Fact k="Division" v={s.division} /><Fact k="Category" v={s.category} /><Fact k="Organizer" v={s.organizer} /><Fact k="What to bring" v={s.equipment} /><Fact k="Notes" v={s.notes} /></dl></>}
      <div className="flex flex-wrap items-start gap-2 px-4 pb-4">{place && <Button variant="primary" onClick={() => openMaps(place)}><Navigation className="h-4 w-4" />Directions</Button>}<Docs docs={docs} canEdit={canEdit} eventId={s.event_id} link={{ competition_session_id: s.id }} />{canEdit && <Button variant="soft" onClick={onEdit}><Pencil className="h-4 w-4" />Edit</Button>}</div>
    </div>
  );
}
export function PassesPage() {
  const { b } = useEvent();
  const important = b.documents.filter((d) => d.is_important || d.doc_type === 'ticket' || d.doc_type === 'confirmation');
  const none = !b.travel.length && !b.stays.length && !important.length;
  return (
    <div className="mx-auto max-w-2xl space-y-3 p-4 lg:p-6">
      <h2 className="font-display text-[26px] font-bold">Passes</h2>
      {none ? <EmptyState icon={Plane} title="Nothing here yet" body="Flights, stays, and starred documents collect here for quick access." /> : <>
        {b.travel.map((t) => <TravelCard key={t.id} t={t} pass />)}{b.stays.map((s) => <StayCard key={s.id} s={s} pass />)}
        {important.length > 0 && <Card className="p-3"><DocList docs={important} /></Card>}
      </>}
    </div>
  );
}
