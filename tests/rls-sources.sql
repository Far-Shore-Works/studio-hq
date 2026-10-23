-- Checks for migration 20261023000700: a doc's source (source_url, source_commit, synced_at) and the ledger's
-- csv_key. Same method as tests/rls-docs.sql: run it as postgres (`bin/studio-hq-sql check tests/rls-sources.sql`,
-- the SQL editor, or the local database in tests/db.test.ts). It ends by raising its own summary, so every
-- row it makes rolls back. "RLS RESULT: n/n passed" means all good; any "FAIL ..." line names the broken check.
do $$
declare
  v_out text[] := '{}';
  v_pass int := 0;
  v_fail int := 0;
  v_n int;
  v_chris_mid uuid;
  v_aaron_mid uuid;
  v_chris_email text;
  v_aaron_email text;
  v_chris uuid;
  v_aaron uuid;
  v_audit_before bigint;
  v_upd timestamptz;
  v_by text;
  v_sync timestamptz;
  v_cnt int;
begin
  select id, email into v_chris_mid, v_chris_email from public.members where role = 'chris';
  select id, email into v_aaron_mid, v_aaron_email from public.members where role = 'aaron';
  select coalesce(max(id), 0) into v_audit_before from public.audit_log;

  select id into v_chris from auth.users where lower(email) = v_chris_email limit 1;
  if v_chris is null then
    v_chris := gen_random_uuid();
    insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_chris, v_chris_email, now(), 'authenticated', 'authenticated');
  end if;
  select id into v_aaron from auth.users where lower(email) = v_aaron_email limit 1;
  if v_aaron is null then
    v_aaron := gen_random_uuid();
    insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_aaron, v_aaron_email, now(), 'authenticated', 'authenticated');
  end if;

  insert into public.docs (id, folder, title, slug, body_md, visibility, owner, source_path, source_url, source_commit, synced_at) values
    ('rls-src-shared', 'Money', 'RLS source test: shared', 'rls-src-shared', 'shared body', 'shared', v_chris_mid, 'studio/ledger/README.md',
     'https://github.com/Far-Shore-Works/studio/blob/main/ledger/README.md', 'abc1234', now() - interval '1 day'),
    ('rls-src-private', 'Plan', 'RLS source test: private', 'rls-src-private', 'SECRET-SOURCE', 'private', v_chris_mid, 'x/PLAN.md',
     'https://github.com/Far-Shore-Works/studio/blob/main/x/PLAN.md', 'abc1234', null);

  -- 1. Shape checks (as the database owner): only Far-Shore-Works GitHub links, only real commit hashes
  begin
    update public.docs set source_url = 'https://evil.example.com/Far-Shore-Works/studio/blob/main/x.md' where id = 'rls-src-shared';
    v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL source_url: a non-GitHub link was accepted');
  exception when check_violation then v_pass := v_pass + 1;
  end;
  begin
    update public.docs set source_url = 'https://github.com/someone-else/studio/blob/main/x.md' where id = 'rls-src-shared';
    v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL source_url: another organization''s repo was accepted');
  exception when check_violation then v_pass := v_pass + 1;
  end;
  begin
    update public.docs set source_url = 'javascript:alert(1)' where id = 'rls-src-shared';
    v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL source_url: a javascript: link was accepted');
  exception when check_violation then v_pass := v_pass + 1;
  end;
  begin
    update public.docs set source_commit = 'not a hash' where id = 'rls-src-shared';
    v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL source_commit: junk accepted');
  exception when check_violation then v_pass := v_pass + 1;
  end;
  begin
    update public.docs set source_url = 'https://github.com/Far-Shore-Works/studio/blob/main/a b.md' where id = 'rls-src-shared';
    v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL source_url: a link with a space was accepted');
  exception when check_violation then v_pass := v_pass + 1;
  end;

  -- 2. The sync heartbeat: moves synced_at, leaves the edit stamps alone, writes no audit entry
  select updated_at, updated_by into v_upd, v_by from public.docs where id = 'rls-src-shared';
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  execute 'update public.docs set synced_at = now(), actor = ''claude-code:chris'' where id = ''rls-src-shared''';
  execute 'reset role';
  select synced_at into v_sync from public.docs where id = 'rls-src-shared';
  if v_sync > now() - interval '1 minute' then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL heartbeat: synced_at did not move'); end if;
  select count(*) into v_n from public.docs where id = 'rls-src-shared' and updated_at = v_upd and updated_by is not distinct from v_by;
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL heartbeat: it changed updated_at or updated_by'); end if;
  select count(*) into v_n from public.audit_log where id > v_audit_before and table_name = 'docs' and row_id = 'rls-src-shared' and op = 'update';
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL heartbeat: it was written to the audit log'); end if;

  -- 3. Setting the source columns alone is not an edit either; a real content change still is
  execute 'set local role service_role';
  execute 'update public.docs set source_commit = ''def5678'', actor = ''claude-code:chris'' where id = ''rls-src-shared''';
  execute 'reset role';
  select count(*) into v_n from public.audit_log where id > v_audit_before and table_name = 'docs' and row_id = 'rls-src-shared' and op = 'update';
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL source: a commit-only change was logged as an edit'); end if;
  execute 'set local role service_role';
  execute 'update public.docs set body_md = ''shared body v2'', synced_at = now(), actor = ''claude-code:aaron'' where id = ''rls-src-shared''';
  execute 'reset role';
  select count(*) into v_n from public.docs where id = 'rls-src-shared' and updated_at >= v_upd and updated_by = 'claude-code:aaron';
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL content change: updated_at / updated_by not stamped'); end if;
  select count(*) into v_n from public.audit_log where id > v_audit_before and table_name = 'docs' and row_id = 'rls-src-shared' and op = 'update' and via = 'claude-code:aaron';
  if v_n >= 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL content change: not logged with the actor'); end if;
  select count(*) into v_n from public.audit_log where id > v_audit_before and table_name = 'docs' and (changes::text ilike '%body%' or changes::text ilike '%SECRET%' or changes::text ilike '%shared body%');
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL audit: a doc body reached the audit log'); end if;

  -- 4. Aaron: reads the source of a shared doc, cannot change it, never sees Chris's private doc or its source
  perform set_config('request.jwt.claims', json_build_object('sub', v_aaron, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute 'select count(*) from public.docs where id = ''rls-src-shared'' and source_url like ''https://github.com/Far-Shore-Works/studio/blob/main/%'' and source_commit is not null and synced_at is not null' into v_n;
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL aaron: cannot read the source of a shared doc'); end if;
  execute 'select count(*) from public.docs where source_url ilike ''%x/PLAN.md%'' or id = ''rls-src-private''' into v_n;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL aaron: saw the source of Chris''s private doc'); end if;
  begin
    execute 'update public.docs set source_url = ''https://github.com/Far-Shore-Works/studio/blob/main/other.md'' where id = ''rls-src-shared''';
    v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL aaron: changed a doc source from the app');
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute 'update public.docs set synced_at = now() where id = ''rls-src-shared''';
    v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL aaron: moved synced_at from the app');
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'reset role';

  -- 5. Ledger csv_key: the app cannot write it, agents can, and it is unique when set
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    execute 'select count(*) from public.ledger where csv_key is not null';
    v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL anon: read the ledger');
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_chris, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute 'insert into public.ledger (date, item, amount_usd, paid_by, csv_key) values (date ''2026-10-01'', ''rls forged line'', 1, ''Chris'', ''kforged'')';
    v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL chris: set csv_key when adding a line in the app');
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'insert into public.ledger (date, item, amount_usd, paid_by) values (date ''2026-10-01'', ''rls app line'', 2.5, ''Chris'')';
  execute 'insert into public.ledger (date, item, amount_usd, paid_by) values (date ''2026-10-02'', ''rls app line 2'', 3, ''Chris'')';
  select count(*) into v_n from public.ledger where item like 'rls app line%' and csv_key is null;
  if v_n = 2 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL ledger: lines typed in the app should have no csv_key (and two of them must coexist)'); end if;
  begin
    execute 'update public.ledger set csv_key = ''kforged'' where item = ''rls app line''';
    v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL chris: set csv_key on a line from the app');
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  execute 'insert into public.ledger (date, item, amount_usd, paid_by, csv_key, actor) values (date ''2026-10-03'', ''rls csv line'', 4, ''Aaron'', ''k0123456789abcdef'', ''claude-code:chris'')';
  execute 'update public.ledger set csv_key = ''kadopted'', actor = ''claude-code:chris'' where item = ''rls app line''';
  begin
    execute 'insert into public.ledger (date, item, amount_usd, paid_by, csv_key) values (date ''2026-10-04'', ''rls dup'', 5, ''Aaron'', ''k0123456789abcdef'')';
    v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL ledger: a duplicate csv_key was accepted');
  exception when unique_violation then v_pass := v_pass + 1;
  end;
  begin
    execute 'insert into public.ledger (date, item, amount_usd, paid_by, csv_key) values (date ''2026-10-04'', ''rls bad key'', 5, ''Aaron'', ''has a space'')';
    v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL ledger: a malformed csv_key was accepted');
  exception when check_violation then v_pass := v_pass + 1;
  end;
  execute 'reset role';
  select count(*) into v_n from public.ledger where csv_key in ('k0123456789abcdef', 'kadopted');
  if v_n = 2 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, 'FAIL ledger: an agent could not set csv_key'); end if;
  -- the rest of the app's ledger rights are unchanged: a founder reads every line
  perform set_config('request.jwt.claims', json_build_object('sub', v_aaron, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute 'select count(*) from public.ledger where item like ''rls%''' into v_n;
  execute 'reset role';
  if v_n = 3 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, (('FAIL aaron: sees ' || v_n || ' of the 3 test ledger lines'))::text); end if;

  raise exception 'RLS RESULT: %/% passed%', v_pass, v_pass + v_fail,
    case when v_fail = 0 then '' else E'\n' || array_to_string(v_out, E'\n') end;
end
$$;
