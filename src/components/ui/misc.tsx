import * as React from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn, initials } from '@/lib/utils';

export const inputClass = 'w-full min-h-12 rounded-xl border border-line bg-card px-3.5 py-2.5 text-ink placeholder:text-ink-soft/70 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25';
export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({ className, ...p }, r) => <input ref={r} className={cn(inputClass, className)} {...p} />);
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(({ className, ...p }, r) => <textarea ref={r} rows={3} className={cn(inputClass, 'resize-y', className)} {...p} />);
export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(({ className, ...p }, r) => <select ref={r} className={cn(inputClass, 'appearance-auto', className)} {...p} />);

export function Field({ label, error, htmlFor, children, hint }: { label: string; error?: string; htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[15px] font-medium text-ink">{label}</label>
      {children}
      {hint && !error && <p className="text-sm text-ink-soft">{hint}</p>}
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
export function Card({ className, ...p }: React.ComponentProps<'div'>) { return <div className={cn('rounded-xl2 bg-card shadow-soft', className)} {...p} />; }
export function Spinner({ className }: { className?: string }) { return <Loader2 aria-label="Loading" className={cn('h-6 w-6 animate-spin text-teal', className)} />; }
export function PageLoader() { return <div className="space-y-4 p-4 lg:p-8" aria-busy="true" aria-label="Loading"><div className="skeleton h-48" /><div className="skeleton h-20" /><div className="skeleton h-20" /></div>; }
export function EmptyState({ icon: I, title, body, children }: { icon: LucideIcon; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-teal-soft text-teal"><I className="h-6 w-6" aria-hidden /></span>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-ink-soft">{body}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
const tones: Record<string, string> = { neutral: 'bg-sand text-ink', teal: 'bg-teal-soft text-teal', accent: 'bg-accent-soft text-accent', gold: 'bg-gold-soft text-gold', danger: 'bg-accent-soft text-danger' };
export function Badge({ tone = 'neutral', className, ...p }: React.ComponentProps<'span'> & { tone?: keyof typeof tones | string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold', tones[tone], className)} {...p} />;
}
export function Progress({ value, label }: { value: number; label: string }) {
  return <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-sand"><div className="h-full rounded-full bg-teal transition-all" style={{ width: `${value}%` }} /></div>;
}
const avatarColors = ['#0F6B6B', '#C94F38', '#16263D', '#A36F12', '#5B5F97', '#3E7C59'];
const colorFor = (s: string) => avatarColors[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length];
export function Avatar({ name, src, size = 36, className }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const [bad, setBad] = React.useState(false);
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (src && !bad) return <img src={src} alt={name ?? ''} referrerPolicy="no-referrer" onError={() => setBad(true)} style={style} className={cn('shrink-0 rounded-full object-cover', className)} />;
  return <span aria-label={name ?? undefined} style={{ ...style, background: colorFor(name || '?') }} className={cn('inline-grid shrink-0 place-items-center rounded-full font-semibold text-white', className)}>{initials(name)}</span>;
}
export function AvatarStack({ people, max = 4, size = 30 }: { people: { name: string; src?: string | null }[]; max?: number; size?: number }) {
  const extra = people.length - max;
  return (
    <div className="flex items-center">
      {people.slice(0, max).map((p, i) => <Avatar key={i} name={p.name} src={p.src} size={size} className={cn('ring-2 ring-white', i > 0 && '-ml-2')} />)}
      {extra > 0 && <span style={{ width: size, height: size }} className="-ml-2 grid place-items-center rounded-full bg-sand text-xs font-semibold ring-2 ring-white">+{extra}</span>}
    </div>
  );
}
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-2xl bg-sand p-1">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} type="button" onClick={() => onChange(o.value)}
          className={cn('min-h-10 flex-1 rounded-xl px-3 text-[15px] font-semibold transition', value === o.value ? 'bg-card text-ink shadow-soft' : 'text-ink-soft')}>{o.label}</button>
      ))}
    </div>
  );
}
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="mb-2.5 flex items-center justify-between gap-3"><h2 className="font-display text-[21px] font-semibold">{children}</h2>{action}</div>;
}
