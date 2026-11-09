import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, PageLoader, SectionTitle } from '@/components/ui/misc';
import { rpc } from '@/data/api';
import { formatDayShort, timeAgo } from '@/domain/time';

interface Family { id: string; name: string; created_at: string; members: number; guests: number; events: number; last_activity: string | null; }
interface Stats { users: number; families: number; events: number; upcoming_events: number; new_users_7d: number; new_users_30d: number; active_users_7d: number; active_users_30d: number; signups_by_week: { week: string; count: number }[]; families_list: Family[]; }

function Tile({ label, value, note }: { label: string; value: number; note?: string }) {
  return <Card className="p-4"><div className="text-[15px] text-ink-soft">{label}</div><div className="font-display text-[34px] font-bold leading-tight tabular-nums">{value.toLocaleString()}</div>{note && <div className="text-sm text-ink-soft">{note}</div>}</Card>;
}
export function AdminPage() {
  const q = useQuery({ queryKey: ['admin-stats'], queryFn: () => rpc<Stats>('admin_stats', {}), retry: false, staleTime: 30_000 });
  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <EmptyState icon={ShieldAlert} title="This page isn't available" body="Only administrators can see it."><Button asChild><Link to="/">Go home</Link></Button></EmptyState>;
  const s = q.data;
  return (
    <div className="pb-nav page-enter mx-auto max-w-4xl space-y-6 px-4 pt-safe lg:p-8">
      <div className="pt-4"><h1 className="font-display text-[30px] font-bold">Admin</h1><p className="text-ink-soft">Totals only. Itineraries and documents stay private.</p></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Users" value={s.users} note={`${s.new_users_7d} new in 7 days`} />
        <Tile label="Families" value={s.families} />
        <Tile label="Events" value={s.events} note={`${s.upcoming_events} current or upcoming`} />
        <Tile label="Active users, 7 days" value={s.active_users_7d} note={`${s.active_users_30d} in 30 days`} />
      </div>
      <p className="text-sm text-ink-soft">Active means the person changed something in an event.</p>
      <section><SectionTitle>Families</SectionTitle>
        {s.families_list.length === 0 ? <p className="text-ink-soft">No families yet.</p> : <ul className="space-y-2">{s.families_list.map((f) => <li key={f.id}><Card className="p-3.5"><div className="font-semibold">{f.name}</div><div className="text-[15px] text-ink-soft">{f.members} {f.members === 1 ? 'member' : 'members'}{f.guests ? `, ${f.guests} invited to events` : ''}, {f.events} {f.events === 1 ? 'event' : 'events'}</div><div className="text-sm text-ink-soft">Started {timeAgo(f.created_at)}{f.last_activity ? `, last active ${timeAgo(f.last_activity)}` : ''}</div></Card></li>)}</ul>}
      </section>
      <section><SectionTitle>Sign-ups by week</SectionTitle>
        <Card className="overflow-hidden"><table className="w-full text-left"><thead><tr className="border-b border-line text-[15px] text-ink-soft"><th scope="col" className="px-4 py-2.5 font-medium">Week of</th><th scope="col" className="px-4 py-2.5 text-right font-medium">New users</th></tr></thead><tbody>{s.signups_by_week.map((w) => <tr key={w.week} className="border-b border-line last:border-0"><td className="px-4 py-2.5">{formatDayShort(w.week)}</td><td className="px-4 py-2.5 text-right tabular-nums">{w.count}</td></tr>)}</tbody></table></Card>
      </section>
    </div>
  );
}
