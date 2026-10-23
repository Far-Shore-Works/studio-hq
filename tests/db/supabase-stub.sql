-- Just enough of a Supabase project to run supabase/migrations/*.sql in a local Postgres (PGlite) for tests:
-- the API roles, auth.users and auth.uid(), the realtime publication, and the default privileges every
-- new table gets on Supabase (which the migrations then revoke). Test scaffolding only; never run on the real project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supabase_auth_admin nologin;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  aud text,
  role text
);
create unique index users_email_key on auth.users (lower(email));
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  ), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create publication supabase_realtime;
create function public.rls_auto_enable() returns void language sql as 'select 1';
