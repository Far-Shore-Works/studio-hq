-- Studio HQ schema: one table per collection, a members allowlist, row-level security,
-- an audit log filled by triggers, two voting functions and realtime.
--
-- Who can do what
--   anon (no sign-in) ........ nothing.
--   authenticated ............ only when their auth user is linked to a row in public.members
--                              (the two founders' emails). Read everything; add rows;
--                              edit the editable columns; agree and vote only for themselves (set_agree,
--                              set_vote). No deletes from the app.
--   service_role / postgres .. agents and SQL (Supabase MCP, dashboard). Bypass RLS; the audit log still
--                              records them, with the `actor` they supply.
--
-- `actor` is a write-only label on every data table: set it in the same statement as the change
-- (e.g. actor = 'claude-code:chris'); the trigger copies it into audit_log and the row's created_by /
-- updated_by, then clears it.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Members: the allowlist. user_id is filled when that email signs in (trigger on auth.users).
create table public.members (
  id uuid primary key default gen_random_uuid(),
  role text not null unique check (role in ('chris', 'aaron')),
  name text not null,
  email text not null unique check (email = lower(email)),
  user_id uuid unique references auth.users (id) on delete set null,
  avatar_url text,
  claude_id text unique,
  created_at timestamptz not null default now()
);
alter table public.members enable row level security;

create function private.current_member_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select m.id from public.members m where m.user_id = (select auth.uid()) $$;

create function private.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.members m where m.user_id = (select auth.uid())) $$;

revoke all on function private.current_member_id() from public;
revoke all on function private.is_member() from public;
grant execute on function private.current_member_id() to authenticated, service_role;
grant execute on function private.is_member() to authenticated, service_role;

-- Link an auth user to its members row once the email is confirmed (magic link clicked, or a verified
-- GitHub email). Unconfirmed users never link.
create function private.link_member() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is not null and new.email_confirmed_at is not null then
    update public.members m
       set user_id = new.id,
           avatar_url = coalesce(nullif(new.raw_user_meta_data ->> 'avatar_url', ''), m.avatar_url)
     where m.email = lower(new.email)
       and (m.user_id is null or m.user_id = new.id);
  end if;
  return new;
end
$$;
revoke all on function private.link_member() from public;
create trigger link_member
  after insert or update of email, email_confirmed_at, raw_user_meta_data on auth.users
  for each row execute function private.link_member();

create policy members_read on public.members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_member()));

-- ---------------------------------------------------------------------------------------------
-- Collections. Every data table carries the same bookkeeping columns, set by the trigger.
create table public.steps (
  id text primary key default gen_random_uuid()::text,
  phase int not null default 1 check (phase between 1 and 6),
  sort_order numeric not null default 999,
  title text not null check (char_length(title) between 1 and 500),
  owner text check (owner in ('chris', 'aaron', 'both')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'blocked')),
  cost text,
  note text,
  detail text,
  due date,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  actor text
);

create table public.comments (
  id text primary key default gen_random_uuid()::text,
  step_id text not null references public.steps (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  author_id uuid references public.members (id),
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  actor text
);
create index comments_step_idx on public.comments (step_id);
create index comments_created_idx on public.comments (created_at desc);

create table public.messages (
  id text primary key default gen_random_uuid()::text,
  text text not null check (char_length(text) between 1 and 4000),
  author_id uuid references public.members (id),
  kind text not null default 'msg',
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  actor text
);
create index messages_created_idx on public.messages (created_at desc);

-- agree: null = an older decision that was settled when written; {} or {member_id: iso} = open/agreed.
create table public.decisions (
  id text primary key default gen_random_uuid()::text,
  date date,
  title text not null check (char_length(title) between 1 and 500),
  detail text,
  agree jsonb check (agree is null or jsonb_typeof(agree) = 'object'),
  proposed_by uuid references public.members (id),
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  actor text
);

create table public.names (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(name) between 1 and 120),
  note text,
  sort_order numeric not null default 999,
  votes jsonb not null default '{}'::jsonb check (jsonb_typeof(votes) = 'object'),
  suggested_by uuid references public.members (id),
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  actor text
);

create table public.products (
  id text primary key default gen_random_uuid()::text,
  sort_order numeric not null default 999,
  name text not null check (char_length(name) between 1 and 200),
  status text,
  platforms text,
  summary text,
  next text,
  in_company text,
  repo text,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  actor text
);

-- meta/studio {name, subtitle, links[]} and meta/status {summary, asOf}.
create table public.meta (
  id text primary key,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  actor text
);

-- Mirrors ledger/expenses.csv in the studio repo (the CSV stays the record of purchases).
create table public.ledger (
  id bigint generated always as identity primary key,
  date date not null,
  item text not null,
  vendor text,
  amount_usd numeric(12, 2) not null,
  paid_by text,
  approved_by text,
  category text,
  receipt_location text,
  notes text,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  actor text
);

-- team/chris and team/aaron as the old page saw them.
create view public.team with (security_invoker = true) as
  select m.role as id, m.id as member_id, m.name from public.members m;

-- ---------------------------------------------------------------------------------------------
-- Audit log: append-only, written only by the trigger.
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  table_name text not null,
  row_id text,
  op text not null check (op in ('insert', 'update', 'delete')),
  who text,          -- chris | aaron when a signed-in founder made the change, else null
  via text not null, -- the actor label if one was given, else 'app' (signed-in founder) or the database role
  user_id uuid,
  db_role text,
  changes jsonb
);
create index audit_log_at_idx on public.audit_log (at desc);
alter table public.audit_log enable row level security;
create policy audit_read on public.audit_log for select to authenticated using ((select private.is_member()));

create function private.stamp_and_audit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role text := coalesce(v_claims ->> 'role', session_user::text);
  v_who text;
  v_actor text;
  v_via text;
  v_label text;
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_skip text[] := array['created_at', 'created_by', 'updated_at', 'updated_by', 'actor'];
begin
  if v_uid is not null then
    select m.role into v_who from public.members m where m.user_id = v_uid;
  end if;
  if tg_op <> 'DELETE' then
    v_actor := nullif(btrim(left(new.actor, 80)), '');
  end if;
  v_via := coalesce(v_actor, case when v_who is not null then 'app' else v_role end);
  v_label := coalesce(v_actor, v_who, v_role);

  if tg_op = 'INSERT' then
    new.created_by := v_label;
    new.updated_by := v_label;
    new.actor := null;
    v_changes := to_jsonb(new) - v_skip;
  elsif tg_op = 'UPDATE' then
    new.updated_at := now();
    new.updated_by := v_label;
    new.actor := null;
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    for v_key in select jsonb_object_keys(v_new) loop
      if not (v_key = any (v_skip)) and (v_old -> v_key) is distinct from (v_new -> v_key) then
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return new; -- nothing a person would call a change
    end if;
  else
    v_changes := to_jsonb(old) - v_skip;
  end if;

  insert into public.audit_log (table_name, row_id, op, who, via, user_id, db_role, changes)
  values (tg_table_name, case when tg_op = 'DELETE' then to_jsonb(old) ->> 'id' else to_jsonb(new) ->> 'id' end,
          lower(tg_op), v_who, v_via, v_uid, v_role, v_changes);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;
revoke all on function private.stamp_and_audit() from public;

do $$
declare t text;
begin
  foreach t in array array['steps', 'comments', 'messages', 'decisions', 'names', 'products', 'meta', 'ledger'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger stamp_and_audit before insert or update or delete on public.%I for each row execute function private.stamp_and_audit()', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_member()))', t || '_read', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_member())) with check ((select private.is_member()))', t || '_edit', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end
$$;

-- Inserts: members only, and only in their own name.
create policy steps_add on public.steps for insert to authenticated with check ((select private.is_member()));
create policy products_add on public.products for insert to authenticated with check ((select private.is_member()));
create policy meta_add on public.meta for insert to authenticated with check ((select private.is_member()));
create policy ledger_add on public.ledger for insert to authenticated with check ((select private.is_member()));
create policy comments_add on public.comments for insert to authenticated
  with check ((select private.is_member()) and author_id = (select private.current_member_id()));
create policy messages_add on public.messages for insert to authenticated
  with check ((select private.is_member()) and author_id = (select private.current_member_id()));
create policy decisions_add on public.decisions for insert to authenticated
  with check (
    (select private.is_member())
    and (proposed_by is null or proposed_by = (select private.current_member_id()))
    and agree is not null
    and (agree - ((select private.current_member_id())::text)) = '{}'::jsonb
  );
create policy names_add on public.names for insert to authenticated
  with check (
    (select private.is_member())
    and (suggested_by is null or suggested_by = (select private.current_member_id()))
    and (votes - ((select private.current_member_id())::text)) = '{}'::jsonb
  );

grant insert (id, phase, sort_order, title, owner, status, cost, note, detail, due, created_at, actor) on public.steps to authenticated;
grant insert (id, step_id, text, author_id, created_at, actor) on public.comments to authenticated;
grant insert (id, text, author_id, kind, created_at, actor) on public.messages to authenticated;
grant insert (id, date, title, detail, agree, proposed_by, created_at, actor) on public.decisions to authenticated;
grant insert (id, name, note, sort_order, votes, suggested_by, created_at, actor) on public.names to authenticated;
grant insert (sort_order, name, status, platforms, summary, next, in_company, repo, actor) on public.products to authenticated;
grant insert (id, data, actor) on public.meta to authenticated;
grant insert (date, item, vendor, amount_usd, paid_by, approved_by, category, receipt_location, notes, actor) on public.ledger to authenticated;

-- Edits: only these columns. Agreements and votes go through set_agree / set_vote. Comments and
-- messages can't be edited from the app.
grant update (phase, sort_order, title, owner, status, cost, note, detail, due, actor) on public.steps to authenticated;
grant update (date, title, detail, actor) on public.decisions to authenticated;
grant update (name, note, sort_order, actor) on public.names to authenticated;
grant update (sort_order, name, status, platforms, summary, next, in_company, repo, actor) on public.products to authenticated;
grant update (data, actor) on public.meta to authenticated;
grant update (date, item, vendor, amount_usd, paid_by, approved_by, category, receipt_location, notes, actor) on public.ledger to authenticated;

grant select on public.members, public.team, public.audit_log to authenticated;
grant all on public.members, public.audit_log to service_role;
grant select on public.team to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------------------------
-- Agree and vote, for yourself only.
create function public.set_agree(p_decision text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.current_member_id();
  v_out jsonb;
begin
  if v_me is null then
    raise exception 'not a studio member' using errcode = '42501';
  end if;
  update public.decisions d
     set agree = case when p_on
                      then d.agree || jsonb_build_object(v_me::text, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
                      else d.agree - v_me::text end
   where d.id = p_decision and d.agree is not null
  returning d.agree into v_out;
  if not found then
    raise exception 'no open decision %', p_decision using errcode = 'P0002';
  end if;
  return v_out;
end
$$;

create function public.set_vote(p_name text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.current_member_id();
  v_out jsonb;
begin
  if v_me is null then
    raise exception 'not a studio member' using errcode = '42501';
  end if;
  update public.names n
     set votes = case when p_on then n.votes || jsonb_build_object(v_me::text, true) else n.votes - v_me::text end
   where n.id = p_name
  returning n.votes into v_out;
  if not found then
    raise exception 'no name %', p_name using errcode = 'P0002';
  end if;
  return v_out;
end
$$;

revoke all on function public.set_agree(text, boolean) from public, anon;
revoke all on function public.set_vote(text, boolean) from public, anon;
grant execute on function public.set_agree(text, boolean) to authenticated;
grant execute on function public.set_vote(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Realtime: every table the page shows (RLS applies to what each subscriber receives).
alter publication supabase_realtime add table
  public.steps, public.comments, public.messages, public.decisions, public.names,
  public.products, public.meta, public.members, public.audit_log;
