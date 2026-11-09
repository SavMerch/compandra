-- Minimal stand-in for the Supabase-managed pieces, used only by local tests.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role authenticator login password 'test' noinherit;
grant anon, authenticated, service_role to authenticator;
create schema auth; create schema storage;
grant usage on schema auth, storage to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub','')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
create publication supabase_realtime;
