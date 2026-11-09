import type { BrowserContext, Page } from '@playwright/test';
import jwt from 'jsonwebtoken';
import pg from 'pg';
export const db = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:54329/compandra' });
const SECRET = 'e2e-secret-e2e-secret-e2e-secret-e2e';
let n = 0;
export async function makeUser(name: string) {
  const email = `${name.toLowerCase()}${Date.now()}${n++}@example.test`;
  const id = (await db.query('insert into auth.users(email, raw_user_meta_data) values ($1,$2) returning id', [email, { full_name: name }])).rows[0].id as string;
  return { id, email, name };
}
export async function signIn(ctx: BrowserContext, u: { id: string; email: string }) {
  const exp = Math.floor(Date.now() / 1000) + 7200;
  const access_token = jwt.sign({ sub: u.id, role: 'authenticated', email: u.email, exp }, SECRET);
  const session = { access_token, refresh_token: 'x', expires_at: exp, expires_in: 7200, token_type: 'bearer', user: { id: u.id, email: u.email, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' } };
  await ctx.addInitScript((s) => localStorage.setItem('compandra-auth', s), JSON.stringify(session));
}
export const shot = async (p: Page, name: string) => { await p.waitForTimeout(400); return p.screenshot({ path: `tests/e2e/shots/${name}.png` }); };
export async function asUser<T = any>(uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  const c = await db.connect();
  try { await c.query('begin'); await c.query(`select set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: uid })]); await c.query('set local role authenticated'); const r = await c.query(sql, params as any[]); await c.query('commit'); return r.rows; }
  catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
}
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
export async function familyWithSample(name = 'Owner') {
  const u = await makeUser(name);
  const ws = (await asUser(u.id, `select create_workspace('Test family') id`))[0].id as string;
  const ev = (await asUser(u.id, `select create_sample_event($1,$2::date) id`, [ws, today()]))[0].id as string;
  return { u, ws, ev };
}
