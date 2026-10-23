-- Hardening after the security review (2026-10-23).
--  1. Start every table from no privileges for anon/authenticated, then grant only what the app needs.
--     The app can no longer write `actor`, so a founder can't label their own edit as an agent or the import.
--  2. Stamp rows BEFORE the write, but record audit_log AFTER it, so a skipped insert (ON CONFLICT DO NOTHING)
--     never leaves a fake entry and an upsert is logged as what really happened.
--  3. Deletes by agents can be labelled with `set local studio.actor = '...'`; service_role can read but
--     not change audit_log; TRUNCATE is refused on every audited table.
--  4. Membership follows the account's current confirmed email: changing it away from a founder address
--     ends access at once.
--  5. Realtime stops publishing DELETE events (they skip row-level security); the page refreshes from the
--     audit_log insert that every delete produces.

begin;

-- 1. Privileges ----------------------------------------------------------------------------------
revoke all privileges on table
  public.members, public.team, public.audit_log,
  public.steps, public.comments, public.messages, public.decisions,
  public.names, public.products, public.meta, public.ledger
from public, anon, authenticated;

grant select on public.steps, public.comments, public.messages, public.decisions, public.names,
  public.products, public.meta, public.ledger, public.members, public.team, public.audit_log to authenticated;

grant insert (id, phase, sort_order, title, owner, status, cost, note, detail, due, created_at) on public.steps to authenticated;
grant insert (id, step_id, text, author_id, created_at) on public.comments to authenticated;
grant insert (id, text, author_id, kind, created_at) on public.messages to authenticated;
grant insert (id, date, title, detail, agree, proposed_by, created_at) on public.decisions to authenticated;
grant insert (id, name, note, sort_order, votes, suggested_by, created_at) on public.names to authenticated;
grant insert (sort_order, name, status, platforms, summary, next, in_company, repo) on public.products to authenticated;
grant insert (id, data) on public.meta to authenticated;
grant insert (date, item, vendor, amount_usd, paid_by, approved_by, category, receipt_location, notes) on public.ledger to authenticated;

grant update (phase, sort_order, title, owner, status, cost, note, detail, due) on public.steps to authenticated;
grant update (date, title, detail) on public.decisions to authenticated;
grant update (name, note, sort_order) on public.names to authenticated;
grant update (sort_order, name, status, platforms, summary, next, in_company, repo) on public.products to authenticated;
grant update (data) on public.meta to authenticated;
grant update (date, item, vendor, amount_usd, paid_by, approved_by, category, receipt_location, notes) on public.ledger to authenticated;

-- Agents (service_role over REST) keep full data access but only read the audit log.
revoke all on public.audit_log from service_role;
grant select on public.audit_log to service_role;

-- 4. Membership follows the current confirmed email ---------------------------------------------
create or replace function private.current_member_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.id
  from public.members m
  join auth.users u on u.id = m.user_id
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null
    and m.email = lower(u.email)
$$;

create or replace function private.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$ select private.current_member_id() is not null $$;

alter policy members_read on public.members using ((select private.is_member()));

create or replace function private.link_member() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.members m
     set user_id = null
   where m.user_id = new.id
     and (new.email_confirmed_at is null or m.email is distinct from lower(new.email));
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

-- 2 + 3. Stamp before, audit after ---------------------------------------------------------------
create or replace function private.stamp_and_audit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role text := coalesce(v_claims ->> 'role', nullif(current_setting('role', true), 'none'), session_user::text);
  v_uid uuid := auth.uid();
  v_who text;
  v_actor text;
  v_label text;
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb;
  v_skip text[] := array['created_at', 'created_by', 'updated_at', 'updated_by', 'actor'];
begin
  if v_role in ('authenticated', 'anon') then
    select m.role into v_who from public.members m where m.id = private.current_member_id();
    if v_who is null then
      raise exception 'not a studio member' using errcode = '42501';
    end if;
  end if;

  if tg_when = 'BEFORE' then
    if v_who is not null then
      if tg_op = 'DELETE' then
        raise exception 'deletes are not allowed from the app' using errcode = '42501';
      end if;
      v_label := v_who; -- a founder's own edit; any actor value is ignored
    else
      v_actor := nullif(btrim(left(case when tg_op = 'DELETE' then null else new.actor end, 80)), '');
      v_actor := coalesce(v_actor, nullif(btrim(left(current_setting('studio.actor', true), 80)), ''));
      v_label := coalesce(v_actor, v_role);
    end if;

    if tg_op = 'DELETE' then
      return old;
    elsif tg_op = 'UPDATE' then
      if (to_jsonb(new) - v_skip) is not distinct from (to_jsonb(old) - v_skip) then
        return old; -- nothing a person would call a change: keep the old stamps
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

  -- AFTER: the row operation really happened.
  if tg_op = 'INSERT' then
    v_changes := to_jsonb(new) - v_skip;
    v_label := new.created_by;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old) - v_skip;
    v_new := to_jsonb(new) - v_skip;
    select coalesce(jsonb_object_agg(e.key, jsonb_build_object('from', v_old -> e.key, 'to', e.value)), '{}'::jsonb)
      into v_changes
      from jsonb_each(v_new) e
     where (v_old -> e.key) is distinct from e.value;
    if v_changes = '{}'::jsonb then
      return null;
    end if;
    v_label := new.updated_by;
  else
    v_changes := to_jsonb(old) - v_skip;
    v_label := coalesce(nullif(btrim(left(current_setting('studio.actor', true), 80)), ''), v_role);
  end if;

  insert into public.audit_log (table_name, row_id, op, who, via, user_id, db_role, changes)
  values (tg_table_name,
          case when tg_op = 'DELETE' then to_jsonb(old) ->> 'id' else to_jsonb(new) ->> 'id' end,
          lower(tg_op), v_who,
          case when v_who is not null then 'app' else coalesce(v_label, v_role) end,
          v_uid, v_role, v_changes);
  return null;
end
$$;
revoke all on function private.stamp_and_audit() from public, anon, authenticated, service_role;

create function private.reject_truncate() returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'TRUNCATE is not allowed on Studio HQ tables (it would skip the audit log)' using errcode = '42501';
end
$$;
revoke all on function private.reject_truncate() from public, anon, authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['steps', 'comments', 'messages', 'decisions', 'names', 'products', 'meta', 'ledger'] loop
    execute format('drop trigger if exists stamp_and_audit on public.%I', t);
    execute format('create trigger stamp before insert or update or delete on public.%I for each row execute function private.stamp_and_audit()', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function private.stamp_and_audit()', t);
  end loop;
  foreach t in array array['steps', 'comments', 'messages', 'decisions', 'names', 'products', 'meta', 'ledger', 'audit_log'] loop
    execute format('revoke truncate on public.%I from public, anon, authenticated, service_role', t);
    execute format('create trigger reject_truncate before truncate on public.%I for each statement execute function private.reject_truncate()', t);
  end loop;
end
$$;

-- 5. Realtime without DELETE events -----------------------------------------------------------------
alter publication supabase_realtime set (publish = 'insert, update');

commit;
