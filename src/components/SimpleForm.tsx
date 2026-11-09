import * as React from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea, Avatar } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export type FieldDef = {
  name: string; label: string; type?: 'text' | 'textarea' | 'select' | 'date' | 'time' | 'datetime' | 'tel' | 'email' | 'number' | 'checkbox' | 'people';
  required?: boolean; options?: { value: string; label: string }[]; placeholder?: string; hint?: string; half?: boolean;
  show?: (v: Record<string, any>) => boolean; people?: { id: string; name: string }[];
};
function schemaFor(fields: FieldDef[], refine?: (v: any) => { path: string; message: string } | null) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    if (f.type === 'checkbox') shape[f.name] = z.boolean();
    else if (f.type === 'people') shape[f.name] = z.array(z.string());
    else shape[f.name] = f.required ? z.string().trim().min(1, `Enter ${f.label.toLowerCase()}`) : z.string();
  }
  return z.object(shape).superRefine((v, ctx) => { const r = refine?.(v); if (r) ctx.addIssue({ code: 'custom', path: [r.path], message: r.message }); });
}
export function PeoplePicker({ people, value, onChange }: { people: { id: string; name: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  if (!people.length) return <p className="text-sm text-ink-soft">Add people on the Participants page first.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {people.map((p) => {
        const on = value.includes(p.id);
        return (
          <button key={p.id} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])}
            className={cn('flex min-h-11 items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-[15px] font-medium', on ? 'border-teal bg-teal-soft' : 'border-line bg-card')}>
            <Avatar name={p.name} size={32} />{p.name}
          </button>
        );
      })}
    </div>
  );
}
export function SimpleForm({ fields, defaults, onSubmit, submitLabel, refine, extra, onDelete, deleteLabel }: {
  fields: FieldDef[]; defaults: Record<string, any>; onSubmit: (v: Record<string, any>) => Promise<unknown>; submitLabel: string;
  refine?: (v: any) => { path: string; message: string } | null; extra?: React.ReactNode; onDelete?: () => void; deleteLabel?: string;
}) {
  const f = useForm<Record<string, any>>({ defaultValues: defaults, resolver: zodResolver(schemaFor(fields, refine) as any) as Resolver<Record<string, any>> });
  const values = f.watch();
  const err = (n: string) => f.formState.errors[n]?.message as string | undefined;
  return (
    <form noValidate onSubmit={f.handleSubmit(async (v) => { await onSubmit(v); })} className="space-y-4 pb-2">
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        {fields.filter((d) => !d.show || d.show(values)).map((d) => {
          const id = `f-${d.name}`;
          const cls = d.half ? 'col-span-1' : 'col-span-2';
          if (d.type === 'checkbox') return (
            <label key={d.name} className={cn(cls, 'flex min-h-11 items-center gap-3 text-[16px]')}><input type="checkbox" className="h-6 w-6 accent-teal" {...f.register(d.name)} />{d.label}</label>
          );
          if (d.type === 'people') return (
            <div key={d.name} className={cls}><Field label={d.label}><Controller control={f.control} name={d.name} render={({ field }) => <PeoplePicker people={d.people ?? []} value={field.value ?? []} onChange={field.onChange} />} /></Field></div>
          );
          const reg = f.register(d.name);
          return (
            <div key={d.name} className={cn(cls, 'min-w-0')}>
              <Field label={d.label + (d.required ? '' : '')} htmlFor={id} error={err(d.name)} hint={d.hint}>
                {d.type === 'textarea' ? <Textarea id={id} placeholder={d.placeholder} {...reg} />
                  : d.type === 'select' ? <Select id={id} {...reg}>{d.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
                  : <Input id={id} placeholder={d.placeholder} type={d.type === 'datetime' ? 'datetime-local' : d.type ?? 'text'} autoComplete="off" aria-invalid={!!err(d.name)} {...reg} />}
              </Field>
            </div>
          );
        })}
      </div>
      {extra}
      <Button type="submit" size="lg" className="w-full" disabled={f.formState.isSubmitting}>{f.formState.isSubmitting ? 'Saving…' : submitLabel}</Button>
      {onDelete && <Button variant="dangerSoft" className="w-full" onClick={onDelete}>{deleteLabel ?? 'Delete'}</Button>}
    </form>
  );
}
