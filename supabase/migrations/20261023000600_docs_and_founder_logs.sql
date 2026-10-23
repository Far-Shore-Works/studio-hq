-- Docs and founder logs (2026-10-23).
--
--  1. public.docs: markdown documents shown in the Docs tab, in folders, each "shared" (both founders) or
--     "private" (only the member who owns it). Privacy is enforced here, by row-level security: a private doc
--     is not returned to the other founder by the page, the REST API or realtime. Founders cannot write docs
--     from the app (agents do, through service_role and `bin/studio-hq docs-sync`).
--     The audit log never carries a private doc, and never carries any doc's body: see stamp_and_audit_docs().
--  2. public.hours: one row per founder per week. Both founders read all rows; each founder writes only
--     their own (member_id = the caller's member).
--  3. Realtime now also publishes ledger (the Founders panel reads it), docs and hours.
--
-- What this does NOT do: anyone with owner-level database access (the Supabase dashboard or MCP as a member of
-- the Far Shore Works organization) bypasses row-level security and can read every doc. Keep the other
-- founder's organization role in mind before storing anything private here.

begin;

-- 1. Docs ----------------------------------------------------------------------------------------
create table public.docs (
  id text primary key default gen_random_uuid()::text,
  folder text not null check (folder in ('Plan', 'Money', 'Decisions', 'Game', 'Admin')),
  title text not null check (char_length(title) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  body_md text not null default '' check (char_length(body_md) <= 300000),
  visibility text not null default 'private' check (visibility in ('shared', 'private')),
  owner uuid not null references public.members (id),
  source_path text check (source_path is null or char_length(source_path) <= 300),
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  actor text
);
create index docs_folder_idx on public.docs (folder, title);
create index docs_owner_idx on public.docs (owner);

alter table public.docs enable row level security;
revoke all privileges on table public.docs from public, anon, authenticated;
grant select on public.docs to authenticated;
grant all on public.docs to service_role;

-- The only policy: a member sees shared docs and their own private ones. There is no insert, update or
-- delete policy for the app, so those fail for every signed-in account.
create policy docs_read on public.docs for select to authenticated
  using (
    (select private.is_member())
    and (visibility = 'shared' or owner = (select private.current_member_id()))
  );

-- Stamp before, audit after, like the other tables, with two differences:
--  * the app cannot write docs at all, and
--  * the audit entry carries only metadata (folder, title, slug, visibility, source_path), never the body,
--    and nothing is recorded for a doc that is private before and after the change. A doc that is made
--    shared (or un-shared) is recorded, because both founders can see that it exists.
create function private.stamp_and_audit_docs() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role text := coalesce(v_claims ->> 'role', nullif(current_setting('role', true), 'none'), session_user::text);
  v_actor text;
  v_label text;
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb;
  v_keep text[] := array['folder', 'title', 'slug', 'visibility', 'source_path'];
  v_skip text[] := array['created_at', 'created_by', 'updated_at', 'updated_by', 'actor'];
begin
  if v_role in ('authenticated', 'anon') then
    raise exception 'docs are written by agents, not from the app' using errcode = '42501';
  end if;

  if tg_when = 'BEFORE' then
    v_actor := nullif(btrim(left(case when tg_op = 'DELETE' then null else new.actor end, 80)), '');
    v_actor := coalesce(v_actor, nullif(btrim(left(current_setting('studio.actor', true), 80)), ''));
    v_label := coalesce(v_actor, v_role);
    if tg_op = 'DELETE' then
      return old;
    elsif tg_op = 'UPDATE' then
      if (to_jsonb(new) - v_skip) is not distinct from (to_jsonb(old) - v_skip) then
        return old;
      end if;
      new.created_at := old.created_at;
      new.created_by := old.created_by;
      new.updated_at := statement_timestamp();
    else
      new.created_by := v_label;
    end if;
    new.updated_by := v_label;
    new.actor := null;
    return new;
  end if;

  -- AFTER
  if tg_op = 'INSERT' then
    if new.visibility <> 'shared' then
      return null;
    end if;
    select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_changes
      from jsonb_each(to_jsonb(new)) e where e.key = any (v_keep);
    v_label := new.created_by;
  elsif tg_op = 'UPDATE' then
    if old.visibility <> 'shared' and new.visibility <> 'shared' then
      return null;
    end if;
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    select coalesce(jsonb_object_agg(e.key, jsonb_build_object('from', v_old -> e.key, 'to', e.value)), '{}'::jsonb)
      into v_changes
      from jsonb_each(v_new) e
     where e.key = any (v_keep) and (v_old -> e.key) is distinct from e.value;
    if v_changes = '{}'::jsonb then
      if (v_old ->> 'body_md') is distinct from (v_new ->> 'body_md') then
        v_changes := jsonb_build_object('text', jsonb_build_object('from', null, 'to', 'updated'));
      else
        return null;
      end if;
    end if;
    v_label := new.updated_by;
  else
    if old.visibility <> 'shared' then
      return null;
    end if;
    select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_changes
      from jsonb_each(to_jsonb(old)) e where e.key = any (v_keep);
    v_label := coalesce(nullif(btrim(left(current_setting('studio.actor', true), 80)), ''), v_role);
  end if;

  insert into public.audit_log (table_name, row_id, op, who, via, user_id, db_role, changes)
  values ('docs', case when tg_op = 'DELETE' then old.id else new.id end, lower(tg_op), null,
          coalesce(v_label, v_role), null, v_role, v_changes);
  return null;
end
$$;
revoke all on function private.stamp_and_audit_docs() from public, anon, authenticated, service_role;

create trigger stamp before insert or update or delete on public.docs
  for each row execute function private.stamp_and_audit_docs();
create trigger audit after insert or update or delete on public.docs
  for each row execute function private.stamp_and_audit_docs();
revoke truncate on public.docs from public, anon, authenticated, service_role;
create trigger reject_truncate before truncate on public.docs
  for each statement execute function private.reject_truncate();

-- 2. Hours ---------------------------------------------------------------------------------------
create table public.hours (
  id text primary key default gen_random_uuid()::text,
  member_id uuid not null references public.members (id),
  week_start date not null check (extract(isodow from week_start) = 1), -- the Monday of the week
  hours numeric(5, 2) not null check (hours >= 0 and hours <= 168),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  actor text,
  unique (member_id, week_start)
);
create index hours_week_idx on public.hours (week_start desc);

alter table public.hours enable row level security;
revoke all privileges on table public.hours from public, anon, authenticated;
grant select on public.hours to authenticated;
grant insert (member_id, week_start, hours, note) on public.hours to authenticated;
grant update (hours, note) on public.hours to authenticated;
grant all on public.hours to service_role;

create policy hours_read on public.hours for select to authenticated
  using ((select private.is_member()));
create policy hours_add on public.hours for insert to authenticated
  with check ((select private.is_member()) and member_id = (select private.current_member_id()));
create policy hours_edit on public.hours for update to authenticated
  using ((select private.is_member()) and member_id = (select private.current_member_id()))
  with check ((select private.is_member()) and member_id = (select private.current_member_id()));

create trigger stamp before insert or update or delete on public.hours
  for each row execute function private.stamp_and_audit();
create trigger audit after insert or update or delete on public.hours
  for each row execute function private.stamp_and_audit();
revoke truncate on public.hours from public, anon, authenticated, service_role;
create trigger reject_truncate before truncate on public.hours
  for each statement execute function private.reject_truncate();

-- 3. Realtime ------------------------------------------------------------------------------------
alter publication supabase_realtime add table public.ledger, public.docs, public.hours;

commit;
