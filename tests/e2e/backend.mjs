// Local stand-in for Supabase's gateway: real Postgres + real PostgREST (so RLS is real),
// plus small stubs for Auth and Storage. Realtime and OAuth are NOT simulated.
import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';
const db = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:54329/compandra' });
const files = new Map();
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
const body = (r) => new Promise((ok) => { const c = []; r.on('data', (d) => c.push(d)); r.on('end', () => ok(Buffer.concat(c))); });
const uidOf = (req) => { try { return JSON.parse(Buffer.from((req.headers.authorization ?? '').split('.')[1], 'base64url')).sub; } catch { return null; } };
async function asUser(uid, sql, p) {
  const c = await db.connect();
  try { await c.query('begin'); await c.query(`select set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: uid })]); await c.query('set local role authenticated'); const r = await c.query(sql, p); await c.query('commit'); return r.rows; }
  catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
}
const json = (res, code, o) => { res.writeHead(code, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/rest/v1')) {
    const data = await body(req);
    const headers = { ...req.headers, host: 'localhost:3111' }; delete headers.apikey;
    const up = http.request({ port: 3111, path: req.url.replace('/rest/v1', '') || '/', method: req.method, headers }, (r) => { res.writeHead(r.statusCode, { ...r.headers, ...cors }); r.pipe(res); });
    up.on('error', (e) => json(res, 502, { message: e.message })); return up.end(data);
  }
  if (url.pathname.startsWith('/auth/v1/user')) return json(res, 200, { id: uidOf(req), identities: [{ identity_id: 'x', id: 'x', user_id: uidOf(req), provider: 'email', identity_data: {} }] });
  if (url.pathname.startsWith('/auth/v1/logout')) { res.writeHead(204, cors); return res.end(); }
  const m = url.pathname.match(/^\/storage\/v1\/object\/(sign\/)?([^/]+)\/(.+)$/);
  if (m) {
    const [, sign, bucket, raw] = m; const name = decodeURIComponent(raw);
    try {
      if (sign && req.method === 'GET') { const f = files.get(`${bucket}/${name}`); if (!f || url.searchParams.get('token') !== f.token) return json(res, 400, { message: 'Object not found' }); res.writeHead(200, { ...cors, 'content-type': f.type }); return res.end(f.data); }
      if (sign) {
        const rows = await asUser(uidOf(req), 'select 1 from storage.objects where bucket_id=$1 and name=$2', [bucket, name]);
        if (!rows.length) return json(res, 400, { message: 'Object not found', statusCode: '404' });
        const token = crypto.randomUUID(); files.get(`${bucket}/${name}`).token = token;
        return json(res, 200, { signedURL: `/object/sign/${bucket}/${raw}?token=${token}` });
      }
      if (req.method === 'POST') {
        await asUser(uidOf(req), 'insert into storage.objects(bucket_id,name,owner) values($1,$2,$3)', [bucket, name, uidOf(req)]);
        files.set(`${bucket}/${name}`, { data: await body(req), type: req.headers['content-type'] });
        return json(res, 200, { Key: `${bucket}/${name}`, Id: name });
      }
    } catch (e) { return json(res, 403, { message: e.message, statusCode: '403' }); }
  }
  json(res, 404, { message: 'not stubbed: ' + url.pathname });
}).listen(54321, () => console.log('backend on 54321'));
