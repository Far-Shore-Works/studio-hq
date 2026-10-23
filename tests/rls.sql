-- Row-level security checks against the real database. Run as postgres (dashboard SQL editor or the
-- Supabase MCP). Everything happens inside one DO block that ends by raising its own summary, so every
-- change (fake users, writes) rolls back. Read the result in the error text:
--   "RLS RESULT: 27/27 passed" means all good; any "FAIL ..." line names the broken check.
do $$
declare
  v_out text[] := '{}';
  v_pass int := 0;
  v_fail int := 0;
  v_n int;
  v_chris uuid := gen_random_uuid();
  v_out_user uuid := gen_random_uuid();
  v_unconfirmed uuid := gen_random_uuid();
  v_chris_mid uuid;
  v_aaron_mid uuid;
  v_audit_before bigint;
  v_j jsonb;
  v_chris_email text;
  v_aaron_email text;

begin
  select id into v_chris_mid from public.members where role = 'chris';
  select id, email into v_aaron_mid, v_aaron_email from public.members where role = 'aaron';
  select email into v_chris_email from public.members where role = 'chris';
  select coalesce(max(id), 0) into v_audit_before from public.audit_log;

  -- Fake auth users (rolled back at the end): a confirmed Chris, an outsider, an unconfirmed Aaron.
  -- If a real founder account already exists the fake Chris can't take the email; reuse the real link then.
  if exists (select 1 from public.members where role = 'chris' and user_id is not null) then
    select user_id into v_chris from public.members where role = 'chris';
  else
    insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_chris, v_chris_email, now(), 'authenticated', 'authenticated');
  end if;
  insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_out_user, 'stranger@example.com', now(), 'authenticated', 'authenticated');
  if not exists (select 1 from auth.users where lower(email) = v_aaron_email) then
    insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_unconfirmed, v_aaron_email, null, 'authenticated', 'authenticated');
  end if;

  -- 1. Linking
  select count(*) into v_n from public.members where role = 'chris' and user_id = v_chris;
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL link: confirmed founder email not linked'; end if;
  select count(*) into v_n from public.members where user_id = v_out_user;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL link: outsider got linked'; end if;
  select count(*) into v_n from public.members where role = 'aaron' and user_id = v_unconfirmed;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL link: unconfirmed email got linked'; end if;

  -- 2. Anonymous: no table access at all
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    execute 'select count(*) from public.steps' into v_n;
    v_fail := v_fail + 1; v_out := v_out || ('FAIL anon: read steps (' || v_n || ' rows)');
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute 'select count(*) from public.audit_log' into v_n;
    v_fail := v_fail + 1; v_out := v_out || 'FAIL anon: read audit_log';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute 'select public.set_vote(''far-shore-works'', true)';
    v_fail := v_fail + 1; v_out := v_out || 'FAIL anon: called set_vote';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute 'insert into public.messages (text) values (''anon'')';
    v_fail := v_fail + 1; v_out := v_out || 'FAIL anon: inserted a message';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'reset role';

  -- 3. Signed in but not a founder: sees nothing, writes nothing
  perform set_config('request.jwt.claims', json_build_object('sub', v_out_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute 'select count(*) from public.steps' into v_n;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || ('FAIL outsider: sees ' || v_n || ' steps'); end if;
  execute 'select count(*) from public.members' into v_n;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL outsider: sees members'; end if;
  execute 'select count(*) from public.audit_log' into v_n;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL outsider: sees audit_log'; end if;
  execute 'update public.steps set status = ''done'' where id = ''s120''';
  get diagnostics v_n = row_count;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL outsider: updated a step'; end if;
  begin
    execute format('insert into public.messages (text, author_id) values (''x'', %L)', v_chris_mid);
    v_fail := v_fail + 1; v_out := v_out || 'FAIL outsider: posted as Chris';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute 'select public.set_vote(''far-shore-works'', true)';
    v_fail := v_fail + 1; v_out := v_out || 'FAIL outsider: voted';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'reset role';

  -- 4. Chris (a founder)
  perform set_config('request.jwt.claims', json_build_object('sub', v_chris, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute 'select count(*) from public.steps' into v_n;
  if v_n >= 33 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || ('FAIL founder: sees only ' || v_n || ' steps'); end if;
  execute 'select count(*) from public.members' into v_n;
  if v_n = 2 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL founder: members not visible'; end if;
  execute 'update public.steps set status = ''doing'' where id = ''s120''';
  get diagnostics v_n = row_count;
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL founder: could not update a step'; end if;
  execute format('insert into public.messages (text, author_id) values (''rls test'', %L)', v_chris_mid);
  v_pass := v_pass + 1;
  begin
    execute format('insert into public.messages (text, author_id) values (''forged'', %L)', v_aaron_mid);
    v_fail := v_fail + 1; v_out := v_out || 'FAIL founder: posted as Aaron';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute format('update public.decisions set agree = jsonb_build_object(%L, now()) where id = ''d8''', v_aaron_mid::text);
    v_fail := v_fail + 1; v_out := v_out || 'FAIL founder: wrote agree directly (could forge Aaron)';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute format('update public.names set votes = jsonb_build_object(%L, true) where id = ''batture-works''', v_aaron_mid::text);
    v_fail := v_fail + 1; v_out := v_out || 'FAIL founder: wrote votes directly';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'select public.set_agree(''d8'', true)' into v_j;
  if v_j ? v_chris_mid::text and not (v_j ? v_aaron_mid::text) then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || ('FAIL founder: set_agree gave ' || v_j); end if;
  execute 'select public.set_vote(''batture-works'', true)' into v_j;
  if v_j = jsonb_build_object(v_chris_mid::text, true) then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || ('FAIL founder: set_vote gave ' || v_j); end if;
  begin
    execute format('insert into public.decisions (title, agree) values (''forged'', jsonb_build_object(%L, now()))', v_aaron_mid::text);
    v_fail := v_fail + 1; v_out := v_out || 'FAIL founder: proposed a decision pre-agreed by Aaron';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute 'delete from public.steps where id = ''s630''';
    v_fail := v_fail + 1; v_out := v_out || 'FAIL founder: deleted a step from the app';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute 'insert into public.audit_log (table_name, op, via) values (''steps'', ''update'', ''fake'')';
    v_fail := v_fail + 1; v_out := v_out || 'FAIL founder: wrote to audit_log';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute format('update public.members set user_id = %L where role = ''aaron''', v_chris);
    v_fail := v_fail + 1; v_out := v_out || 'FAIL founder: edited members';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'select count(*) from public.audit_log' into v_n;
  if v_n > 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL founder: cannot read audit_log'; end if;
  execute 'reset role';

  -- 5. Audit trail: the founder's step edit is recorded as Chris via the app; an agent write keeps its actor.
  select count(*) into v_n from public.audit_log where id > v_audit_before and table_name = 'steps' and row_id = 's120' and who = 'chris' and via = 'app' and user_id = v_chris;
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL audit: founder edit not recorded as chris/app'; end if;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  execute 'update public.steps set note = ''agent test'', actor = ''claude-code:aaron'' where id = ''s630''';
  execute 'reset role';
  select count(*) into v_n from public.audit_log where id > v_audit_before and row_id = 's630' and via = 'claude-code:aaron' and who is null and db_role = 'service_role';
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL audit: agent actor not recorded'; end if;
  select count(*) into v_n from public.steps where id = 's630' and actor is null and updated_by = 'claude-code:aaron';
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL audit: actor not cleared / updated_by not set'; end if;

  -- 6. Regression cases from the security review
  perform set_config('request.jwt.claims', json_build_object('sub', v_chris, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute 'update public.steps set status = ''blocked'', actor = ''migration'' where id = ''s120''';
    v_fail := v_fail + 1; v_out := v_out || 'FAIL review: founder could set actor (spoof an agent or the import)';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'insert into public.steps (id, title) values (''s120'', ''never inserted'') on conflict do nothing';
  execute 'reset role';
  select count(*) into v_n from public.audit_log where id > v_audit_before and row_id = 's120' and op = 'insert';
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL review: skipped insert left an audit entry'; end if;

  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  begin
    execute 'update public.audit_log set via = ''forged'' where id = (select max(id) from public.audit_log)';
    v_fail := v_fail + 1; v_out := v_out || 'FAIL review: service_role edited audit_log';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute 'truncate public.comments';
    v_fail := v_fail + 1; v_out := v_out || 'FAIL review: service_role truncated a table';
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  perform set_config('studio.actor', 'claude-code:chris', true);
  execute 'delete from public.names where id = ''batture-works''';
  perform set_config('studio.actor', '', true);
  execute 'reset role';
  select count(*) into v_n from public.audit_log where id > v_audit_before and row_id = 'batture-works' and op = 'delete' and via = 'claude-code:chris';
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL review: agent delete not labelled'; end if;

  -- A founder who changes their account email away from the list loses access at once.
  if not exists (select 1 from public.members where role = 'chris' and user_id = v_chris and v_chris <> (select user_id from public.members where role = 'chris' and user_id is not null limit 1)) then
    update auth.users set email = 'moved-away@example.com' where id = v_chris;
    perform set_config('request.jwt.claims', json_build_object('sub', v_chris, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute 'select count(*) from public.steps' into v_n;
    execute 'reset role';
    if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := v_out || 'FAIL review: access kept after email change'; end if;
  end if;

  raise exception 'RLS RESULT: %/% passed%', v_pass, v_pass + v_fail,
    case when v_fail = 0 then '' else E'\n' || array_to_string(v_out, E'\n') end;
end
$$;
