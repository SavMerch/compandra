import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { CoverArt } from '@/components/CoverArt';
import { PeoplePicker } from '@/components/SimpleForm';
import { Button } from '@/components/ui/button';
import { EmptyState, Field, Input, Select, Textarea } from '@/components/ui/misc';
import { useAuth } from '@/auth/AuthProvider';
import { friendlyError, loadWorkspaceMembers, rpc } from '@/data/api';
import { keys } from '@/data/hooks';
import { commonTimeZones, deviceTimeZone } from '@/domain/time';
import { templates, type Template } from '@/domain/templates';
import { cn } from '@/lib/utils';
import { CalendarX } from 'lucide-react';

const schema = z.object({ title: z.string().trim().min(1, 'Give your event a name').max(120), start_date: z.string().min(1, 'Choose a start date'), end_date: z.string().min(1, 'Choose an end date'), destination: z.string(), timezone: z.string(), primary_venue: z.string(), description: z.string() })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, { path: ['end_date'], message: 'End must be on or after start' });
type V = z.infer<typeof schema>;

export function NewEventPage() {
  const { workspace, workspaces, userId } = useAuth();
  const eligible = workspaces.filter((w) => w.role === 'owner' || w.role === 'editor').map((w) => w.workspace);
  const [familyId, setFamilyId] = React.useState(workspace?.id ?? '');
  const target = eligible.find((w) => w.id === familyId) ?? eligible[0];
  const nav = useNavigate(); const qc = useQueryClient();
  const [step, setStep] = React.useState(1);
  const [t, setT] = React.useState<Template | null>(null);
  const [memberIds, setMemberIds] = React.useState<string[]>([]); const [guests, setGuests] = React.useState(''); const [busy, setBusy] = React.useState(false);
  const zone = deviceTimeZone();
  const f = useForm<V>({ resolver: zodResolver(schema), defaultValues: { title: '', start_date: '', end_date: '', destination: '', timezone: zone, primary_venue: '', description: '' } });
  const members = useQuery({ queryKey: ['ws-members', target?.id], enabled: !!target, queryFn: () => loadWorkspaceMembers(target!.id) });
  const zones = commonTimeZones.includes(zone) ? commonTimeZones : [zone, ...commonTimeZones];
  const others = (members.data ?? []).filter((m) => m.user_id !== userId && m.role !== 'guest').map((m) => ({ id: m.user_id, name: m.profile?.display_name || m.profile?.email || 'Family member' }));
  if (!target) return <EmptyState icon={CalendarX} title="Create a family first" body="You've been invited to events in another family. To plan your own, create a family in Profile."><Button asChild><Link to="/profile">Go to Profile</Link></Button></EmptyState>;
  const err = f.formState.errors;
  const create = async (v: V) => {
    if (!t || !target) return;
    setBusy(true);
    try {
      const id = await rpc<string>('create_event', { p: { ...v, workspace_id: target.id, event_type: t.type, cover_scene: t.scene, modules: t.modules, pinned_modules: t.pinned, member_ids: memberIds, guest_names: guests.split(/[\n,]/), starter_packing: t.packing, starter_tasks: t.tasks } });
      await qc.invalidateQueries({ queryKey: keys.events }); toast.success('Event created'); nav(`/events/${id}`, { replace: true });
    } catch (e) { toast.error(friendlyError(e)); setBusy(false); }
  };
  return (
    <div className="pb-nav page-enter mx-auto max-w-xl px-4 pt-safe lg:py-8">
      <div className="flex items-center gap-2 py-3">{step > 1 ? <Button size="icon" variant="ghost" aria-label="Back" onClick={() => setStep(step - 1)}><ArrowLeft className="h-5 w-5" /></Button> : <Button size="icon" variant="ghost" asChild aria-label="Cancel"><Link to="/"><ArrowLeft className="h-5 w-5" /></Link></Button>}<div className="flex flex-1 gap-1.5" aria-label={`Step ${step} of 3`}>{[1, 2, 3].map((n) => <span key={n} className={cn('h-1.5 flex-1 rounded-full', n <= step ? 'bg-teal' : 'bg-line')} />)}</div></div>
      {step === 1 && <><h1 className="mb-4 font-display text-[30px] font-bold">What are you planning?</h1><div className="grid grid-cols-2 gap-3">{templates.map((x) => <button key={x.type} onClick={() => { setT(x); setStep(2); }} className="overflow-hidden rounded-2xl bg-card text-left shadow-soft"><div className="h-20"><CoverArt scene={x.scene} /></div><div className="p-3"><div className="font-semibold">{x.label}</div><div className="text-sm leading-snug text-ink-soft">{x.blurb}</div></div></button>)}</div></>}
      <form noValidate onSubmit={f.handleSubmit(create)}>
        <div className={step === 2 ? 'space-y-4' : 'hidden'}>
          <h1 className="font-display text-[30px] font-bold">The details</h1>
          <Field label="Event name" htmlFor="t" error={err.title?.message}><Input id="t" placeholder="Beach week" {...f.register('title')} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Start date" htmlFor="sd" error={err.start_date?.message}><Input id="sd" type="date" {...f.register('start_date')} onBlur={(e) => { if (e.target.value && !f.getValues('end_date')) f.setValue('end_date', e.target.value); }} /></Field><Field label="End date" htmlFor="ed" error={err.end_date?.message}><Input id="ed" type="date" {...f.register('end_date')} /></Field></div>
          <Field label="Destination (optional)" htmlFor="d"><Input id="d" placeholder="Orlando, Florida" {...f.register('destination')} /></Field>
          <Field label="Event time zone" htmlFor="tz" hint="All times in this event use this zone."><Select id="tz" {...f.register('timezone')}>{zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}</Select></Field>
          <Field label="Primary venue (optional)" htmlFor="v"><Input id="v" {...f.register('primary_venue')} /></Field>
          <Field label="Description (optional)" htmlFor="de"><Textarea id="de" rows={2} {...f.register('description')} /></Field>
          <Button size="lg" className="w-full" onClick={async () => { if (await f.trigger(['title', 'start_date', 'end_date'])) setStep(3); }}>Continue</Button>
        </div>
        <div className={step === 3 ? 'space-y-5' : 'hidden'}>
          <h1 className="font-display text-[30px] font-bold">Who's coming?</h1>
          {eligible.length > 1 && <Field label="Which family is this for?" htmlFor="fam"><Select id="fam" value={target.id} onChange={(e) => { setFamilyId(e.target.value); setMemberIds([]); }}>{eligible.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>}
          {others.length > 0 ? <Field label="Family members"><PeoplePicker people={others} value={memberIds} onChange={setMemberIds} /></Field> : <p className="text-ink-soft">You can invite family after creating the event.</p>}
          <Field label="Anyone without an account, like children" htmlFor="g" hint="Separate names with commas."><Input id="g" value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="Avery, Rowan" /></Field>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</Button>
        </div>
      </form>
    </div>
  );
}
