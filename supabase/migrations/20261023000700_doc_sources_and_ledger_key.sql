-- Where each doc lives, and a unique key for ledger lines (2026-10-23).
--
--  1. public.docs gets three columns so every doc is traceable to the file it was made from:
--       source_url     the file on GitHub (https://github.com/Far-Shore-Works/<repo>/blob/<branch>/<path>)
--       source_commit  the last commit that changed that file (short hash)
--       synced_at      the last time a sync checked the doc against its source (a heartbeat: it moves
--                      without bumping updated_at or writing an audit entry; updated_at stays "content changed")
--     Agents write them (service_role, through `bin/studio-hq docs-sync`); the app only reads them.
--  2. public.ledger gets csv_key, the stable key `bin/studio-hq ledger-sync` upserts by when it mirrors
--     ledger/expenses.csv. It is unique when set; lines typed in the app have none until the CSV has them.
--     The app cannot write it (column grants), so a founder cannot forge a mirrored line.

begin;

alter table public.docs
  add column source_url text check (source_url is null or (char_length(source_url) <= 500 and source_url ~ '^https://github\.com/Far-Shore-Works/[A-Za-z0-9._-]+/blob/[^[:space:]]+$')),
  add column source_commit text check (source_commit is null or source_commit ~ '^[0-9a-f]{7,40}$'),
  add column synced_at timestamptz;

alter table public.ledger
  add column csv_key text check (csv_key is null or csv_key ~ '^[A-Za-z0-9_:.#-]{1,80}$');
create unique index ledger_csv_key_idx on public.ledger (csv_key);

-- Same trigger as before, with one change: a sync that only moves synced_at is kept but not logged.
create or replace function private.stamp_and_audit_docs() returns trigger
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
      if (to_jsonb(new) - v_skip - 'synced_at') is not distinct from (to_jsonb(old) - v_skip - 'synced_at') then
        if new.synced_at is not distinct from old.synced_at then
          return old;
        end if;
        -- Only the "last checked against the source" time moved: keep it, but leave the edit stamps alone.
        new.created_at := old.created_at;
        new.created_by := old.created_by;
        new.updated_at := old.updated_at;
        new.updated_by := old.updated_by;
        new.actor := null;
        return new;
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

commit;
