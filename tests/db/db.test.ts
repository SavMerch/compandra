// Runs the real migrations' RLS and triggers against Postgres. See docs/TESTING.md.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:54329/compandra';
const c = new pg.Client({ connectionString: url });
const U = { owner: '', editor: '', viewer: '', outsider: '', guest: '' };
let ws = ''; let ev = ''; let priv = '';

async function as<T = any>(uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await c.query('begin');
  try {
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid ?? '' })]);
    await c.query(`set local role ${uid ? 'authenticated' : 'anon'}`);
    const r = await c.query(sql, params as any[]);
    await c.query('commit');
    return r.rows;
  } catch (e) { await c.query('rollback'); throw e; }
}
let n = 0;
const mk = async (name: string) => (await c.query(`insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id`, [`${name}${Date.now()}${n++}@x.test`, { full_name: name }])).rows[0].id as string;
const rpc1 = async (uid: string, sql: string, p: unknown[] = []) => Object.values((await as<any>(uid, sql, p))[0] as object)[0] as any;

beforeAll(async () => {
  await c.connect();
  for (const k of Object.keys(U) as (keyof typeof U)[]) U[k] = await mk(k);
  ws = await rpc1(U.owner, `select create_workspace('Fam')`);
  for (const [uid, role] of [[U.editor, 'editor'], [U.viewer, 'viewer']] as const) {
    const t = await rpc1(U.owner, `select create_invitation($1, 'x@x.test', $2)`, [ws, role]);
    await as(uid, `select accept_invitation($1)`, [t]);
  }
  ev = await rpc1(U.editor, `select create_event($1::jsonb)`, [JSON.stringify({ workspace_id: ws, title: 'Trip', start_date: '2027-03-12', end_date: '2027-03-15', timezone: 'America/New_York' })]);
  priv = await rpc1(U.owner, `select create_event($1::jsonb)`, [JSON.stringify({ workspace_id: ws, title: 'Surprise', start_date: '2027-05-01', end_date: '2027-05-01', visibility: 'private' })]);
});
afterAll(async () => { await c.end(); });

describe('profiles and events', () => {
  it('creates a profile with no email-derived name for Apple private relay', async () => {
    const r = (await c.query(`insert into auth.users(email) values ('abc${Date.now()}@privaterelay.appleid.com') returning id`)).rows[0];
    const p = (await c.query('select display_name from profiles where id=$1', [r.id])).rows[0];
    expect(p.display_name).toBe('');
  });
  it('generates one day per date', async () => {
    expect(await as(U.editor, 'select day_date from event_days where event_id=$1 order by 1', [ev])).toHaveLength(4);
  });
  it('moves items on removed days to Ideas instead of losing them', async () => {
    const e = await rpc1(U.owner, `select create_event($1::jsonb)`, [JSON.stringify({ workspace_id: ws, title: 'S', start_date: '2027-01-01', end_date: '2027-01-03' })]);
    const [day] = await as(U.owner, `select id from event_days where event_id=$1 and day_date='2027-01-03'`, [e]);
    const [it] = await as(U.owner, `insert into itinerary_items(event_id,event_day_id,title) values($1,$2,'X') returning id`, [e, day.id]);
    await as(U.owner, `update events set end_date='2027-01-02' where id=$1`, [e]);
    const [after] = await as(U.owner, 'select event_day_id from itinerary_items where id=$1', [it.id]);
    expect(after.event_day_id).toBeNull();
  });
});

describe('workspace isolation and roles', () => {
  it('outsider sees nothing', async () => {
    expect(await as(U.outsider, 'select id from events')).toHaveLength(0);
    expect(await as(U.outsider, 'select id from itinerary_items')).toHaveLength(0);
    expect(await as(U.outsider, 'select id from workspace_members')).toHaveLength(0);
  });
  it('anon cannot read tables', async () => {
    await expect(as(null, 'select id from events')).rejects.toThrow(/permission denied/);
  });
  it('outsider cannot write into another workspace', async () => {
    await expect(as(U.outsider, `insert into itinerary_items(event_id,title) values($1,'x')`, [ev])).rejects.toThrow(/row-level security/);
    await expect(as(U.outsider, `select create_event($1::jsonb)`, [JSON.stringify({ workspace_id: ws, title: 'H', start_date: '2027-01-01', end_date: '2027-01-01' })])).rejects.toThrow(/permission/);
  });
  it('viewer can read but not write the itinerary', async () => {
    expect(await as(U.viewer, 'select id from events where id=$1', [ev])).toHaveLength(1);
    await expect(as(U.viewer, `insert into itinerary_items(event_id,title) values($1,'x')`, [ev])).rejects.toThrow(/row-level security/);
  });
  it('private event is hidden from non-members but visible to the owner', async () => {
    expect(await as(U.editor, 'select id from events where id=$1', [priv])).toHaveLength(0);
    expect(await as(U.viewer, 'select id from event_days where event_id=$1', [priv])).toHaveLength(0);
    expect(await as(U.owner, 'select id from events where id=$1', [priv])).toHaveLength(1);
  });
  it('only owners delete events', async () => {
    expect(await as(U.editor, 'delete from events where id=$1 returning id', [ev])).toHaveLength(0);
  });
  it('event-only guest sees only that event', async () => {
    const t = await rpc1(U.owner, `select create_invitation($1,'g@x.test','viewer',$2)`, [ws, priv]);
    await as(U.guest, 'select accept_invitation($1)', [t]);
    const seen = await as(U.guest, 'select id from events');
    expect(seen.map((r) => r.id)).toEqual([priv]);
  });
  it('workspace cannot lose its last owner', async () => {
    await expect(as(U.owner, `update workspace_members set role='viewer' where workspace_id=$1 and user_id=$2`, [ws, U.owner])).rejects.toThrow(/at least one owner/);
  });
});

describe('invitations', () => {
  it('stores only a hash and is single use', async () => {
    const t = await rpc1(U.owner, `select create_invitation($1,'n@x.test','viewer')`, [ws]);
    const r = await c.query('select token_hash from workspace_invitations where token_hash=$1', [t]);
    expect(r.rows).toHaveLength(0);
    const u = await mk('a'); const u2 = await mk('b');
    await as(u, 'select accept_invitation($1)', [t]);
    await expect(as(u2, 'select accept_invitation($1)', [t])).rejects.toThrow(/already been used/);
  });
  it('previews for anon, and rejects expired tokens', async () => {
    const t = await rpc1(U.owner, `select create_invitation($1,'n@x.test','viewer')`, [ws]);
    const [p] = await as(null, 'select get_invitation_preview($1) p', [t]);
    expect(p.p.valid).toBe(true);
    await c.query(`update workspace_invitations set expires_at = now() - interval '1 day' where token_hash = encode(sha256(convert_to($1::text,'UTF8')),'hex')`, [t]);
    await expect(as(await mk('c'), 'select accept_invitation($1)', [t])).rejects.toThrow(/no longer valid/);
  });
  it('non-owner cannot create workspace invitations', async () => {
    await expect(as(U.viewer, `select create_invitation($1,'q@x.test','editor')`, [ws])).rejects.toThrow(/permission/);
  });
});

describe('linked itinerary records', () => {
  it('flight creates exactly one item, and edits update it', async () => {
    const [s] = await as(U.editor, `insert into travel_segments(event_id,carrier,flight_number,origin,destination,depart_local,arrive_local,confirmation_number)
      values($1,'Delta','123','ATL','MCO','2027-03-12 08:30','2027-03-12 10:00','ABC') returning id`, [ev]);
    let items = await as(U.editor, 'select * from itinerary_items where travel_segment_id=$1', [s.id]);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Flight Delta 123: ATL → MCO');
    await as(U.editor, `update travel_segments set depart_local='2027-03-13 09:45', arrive_local='2027-03-13 11:00' where id=$1`, [s.id]);
    items = await as(U.editor, 'select i.*, d.day_date::text dd from itinerary_items i join event_days d on d.id=i.event_day_id where travel_segment_id=$1', [s.id]);
    expect(items).toHaveLength(1);
    expect(items[0].start_time).toBe('09:45:00');
    expect(items[0].dd).toBe('2027-03-13');
  });
  it('linked item cannot be edited directly or diverge', async () => {
    const [i] = await as(U.editor, 'select id from itinerary_items where travel_segment_id is not null limit 1');
    await expect(as(U.editor, `update itinerary_items set title='z' where id=$1`, [i.id])).rejects.toThrow(/linked/);
    await expect(as(U.editor, `delete from itinerary_items where id=$1`, [i.id])).rejects.toThrow(/linked/);
    await as(U.editor, `update itinerary_items set notes='Gate snacks' where id=$1`, [i.id]);
  });
  it('hotel creates check-in and check-out; deleting removes both', async () => {
    const [a] = await as(U.editor, `insert into accommodations(event_id,name,check_in_local,check_out_local) values($1,'Inn','2027-03-12 15:00','2027-03-15 11:00') returning id`, [ev]);
    expect(await as(U.editor, 'select id from itinerary_items where accommodation_id=$1', [a.id])).toHaveLength(2);
    await as(U.editor, 'delete from accommodations where id=$1', [a.id]);
    expect(await as(U.editor, 'select id from itinerary_items where accommodation_id=$1', [a.id])).toHaveLength(0);
  });
  it('competition appears on the agenda and mirrors participants', async () => {
    const [s] = await as(U.editor, `insert into competition_sessions(event_id,name,session_date,check_in_time,start_time) values($1,'Meet','2027-03-13','07:30','09:00') returning id`, [ev]);
    const [p] = await as(U.editor, `insert into event_participants(event_id,display_name,is_child) values($1,'Kid',true) returning id`, [ev]);
    await as(U.editor, 'insert into competition_session_participants values($1,$2,$3)', [s.id, p.id, ev]);
    const [i] = await as(U.editor, 'select id,start_time from itinerary_items where competition_session_id=$1', [s.id]);
    expect(i.start_time).toBe('07:30:00');
    expect(await as(U.editor, 'select 1 from activity_participants where item_id=$1', [i.id])).toHaveLength(1);
  });
});

describe('collaboration', () => {
  it('version bumps on content change but not reorder (concurrent edit guard)', async () => {
    const [i] = await as(U.editor, `insert into itinerary_items(event_id,title) values($1,'Lunch') returning id,version`, [ev]);
    const [m] = await as(U.editor, 'update itinerary_items set position=5 where id=$1 returning version', [i.id]);
    expect(m.version).toBe(i.version);
    const a = await as(U.editor, `update itinerary_items set title='A' where id=$1 and version=$2 returning version`, [i.id, i.version]);
    const b = await as(U.owner, `update itinerary_items set title='B' where id=$1 and version=$2 returning version`, [i.id, i.version]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(0); // second writer is detected, not silently applied
  });
  it('viewer can tick unassigned packing items but not rename them', async () => {
    const [l] = await as(U.editor, `insert into packing_lists(event_id,name) values($1,'L') returning id`, [ev]);
    const [p] = await as(U.editor, `insert into packing_items(event_id,list_id,name) values($1,$2,'Socks') returning id`, [ev, l.id]);
    const [u] = await as(U.viewer, 'update packing_items set is_packed=true where id=$1 returning packed_by', [p.id]);
    expect(u.packed_by).toBe(U.viewer);
    await expect(as(U.viewer, `update packing_items set name='z' where id=$1`, [p.id])).rejects.toThrow(/check items off/);
  });
  it('viewer can complete only their own task', async () => {
    const [mine] = await as(U.editor, `insert into tasks(event_id,title,assignee_id) values($1,'T',$2) returning id`, [ev, U.viewer]);
    const [other] = await as(U.editor, `insert into tasks(event_id,title) values($1,'O') returning id`, [ev]);
    const [d] = await as(U.viewer, `update tasks set status='done' where id=$1 returning completed_at`, [mine.id]);
    expect(d.completed_at).not.toBeNull();
    expect(await as(U.viewer, `update tasks set status='done' where id=$1 returning id`, [other.id])).toHaveLength(0);
    await expect(as(U.viewer, `update tasks set title='z' where id=$1`, [mine.id])).rejects.toThrow(/status/);
  });
  it('assigning a task notifies only the assignee; notifications are private', async () => {
    const before = (await as(U.viewer, 'select id from notifications')).length;
    await as(U.editor, `insert into tasks(event_id,title,assignee_id) values($1,'N',$2)`, [ev, U.viewer]);
    expect((await as(U.viewer, 'select id from notifications')).length).toBe(before + 1);
    const mine = await as(U.viewer, 'select user_id from notifications');
    expect(mine.every((r) => r.user_id === U.viewer)).toBe(true);
    await expect(as(U.editor, `insert into notifications(user_id,kind,title) values($1,'x','x')`, [U.viewer])).rejects.toThrow(/row-level security/);
  });
  it('attributes activity to the actor and clients cannot forge it', async () => {
    await as(U.editor, `insert into notes(event_id,title) values($1,'Hello')`, [ev]);
    const [l] = await as(U.viewer, `select actor_id from activity_log where entity_type='note' and summary='Hello'`);
    expect(l.actor_id).toBe(U.editor);
    await expect(as(U.editor, `insert into activity_log(event_id,entity_type,action) values($1,'x','created')`, [ev])).rejects.toThrow(/row-level security/);
  });
  it('cannot link across events', async () => {
    const [i] = await as(U.owner, `insert into itinerary_items(event_id,title) values($1,'P') returning id`, [priv]);
    await expect(as(U.owner, `insert into tasks(event_id,title,itinerary_item_id) values($1,'x',$2)`, [ev, i.id])).rejects.toThrow(/foreign key/);
  });
});

describe('storage policies', () => {
  it('limits document objects to event access', async () => {
    await c.query(`insert into storage.objects(bucket_id,name) values('event-files',$1)`, [`${priv}/secret.pdf`]);
    expect(await as(U.owner, 'select id from storage.objects where name=$1', [`${priv}/secret.pdf`])).toHaveLength(1);
    expect(await as(U.editor, 'select id from storage.objects where name=$1', [`${priv}/secret.pdf`])).toHaveLength(0);
    expect(await as(U.outsider, 'select id from storage.objects where name=$1', [`${priv}/secret.pdf`])).toHaveLength(0);
    await expect(as(U.viewer, `insert into storage.objects(bucket_id,name) values('event-files',$1)`, [`${ev}/x.pdf`])).rejects.toThrow(/row-level security/);
    await expect(as(U.editor, `insert into storage.objects(bucket_id,name) values('event-files','not-a-uuid/x.pdf')`)).rejects.toThrow(/row-level security/);
  });
  it('the document bucket is private', async () => {
    const r = await c.query(`select public from storage.buckets where id='event-files'`);
    expect(r.rows[0].public).toBe(false);
  });
});

describe('RPCs', () => {
  it('internal sync functions are not callable by clients', async () => {
    await expect(as(U.outsider, 'select sync_travel_item(t) from travel_segments t')).rejects.toThrow(/permission denied/);
    await expect(as(U.outsider, `select notify_event($1,'x','comments','x','x','x')`, [ev])).rejects.toThrow(/permission denied/);
  });
  it('search respects permissions', async () => {
    await as(U.owner, `insert into itinerary_items(event_id,title) values($1,'Zebra surprise')`, [priv]);
    expect(await as(U.owner, `select * from search_all('zebra')`)).toHaveLength(1);
    expect(await as(U.editor, `select * from search_all('zebra')`)).toHaveLength(0);
  });
  it('sample event builds the full module set and links it to the agenda', async () => {
    const e = await rpc1(U.owner, `select create_sample_event($1,'2027-06-10')`, [ws]);
    const count = async (t: string, w = '') => (await as(U.owner, `select 1 from ${t} where event_id=$1 ${w}`, [e])).length;
    expect(await count('event_days')).toBe(4);
    expect(await count('event_participants')).toBe(5);
    expect(await count('itinerary_items', "and source_type='competition'")).toBe(3);
    expect(await count('itinerary_items', "and source_type='accommodation'")).toBe(2);
    expect(await count('itinerary_items', "and source_type='travel'")).toBe(3);
    expect(await count('itinerary_items', 'and event_day_id is null')).toBe(2);
  });
  it('duplicate shifts dates, resets packing, omits bookings', async () => {
    const e = await rpc1(U.owner, `select create_sample_event($1,'2027-07-10')`, [ws]);
    await as(U.owner, 'update packing_items set is_packed=true where event_id=$1', [e]);
    const nw = await rpc1(U.owner, `select duplicate_event($1,'Again','2028-07-10')`, [e]);
    expect(await as(U.owner, 'select id from travel_segments where event_id=$1', [nw])).toHaveLength(0);
    expect(await as(U.owner, 'select id from packing_items where event_id=$1 and is_packed', [nw])).toHaveLength(0);
    const d = await as(U.owner, `select i.id from itinerary_items i join event_days d on d.id=i.event_day_id where i.event_id=$1 and d.day_date='2028-07-11'`, [nw]);
    expect(d.length).toBeGreaterThan(0);
  });
  it('move rejects changing the day of a linked item', async () => {
    const [i] = await as(U.editor, 'select id,event_id from itinerary_items where event_id=$1 and travel_segment_id is not null limit 1', [ev]);
    const [d] = await as(U.editor, 'select id from event_days where event_id=$1 and day_date=$2', [ev, '2027-03-15']);
    await expect(as(U.editor, 'select move_itinerary_item($1,$2,$3)', [i.id, d.id, [i.id]])).rejects.toThrow(/linked/);
  });
});
