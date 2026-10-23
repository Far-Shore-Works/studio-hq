-- Row-level security checks for the Docs tab and the founders' hours log. Same method as tests/rls.sql: run it as
-- postgres (dashboard SQL editor, or the local database in tests/db.test.ts). One DO block ends by raising
-- its own summary, so every fake user and row rolls back. Read the result in the error text:
--   "RLS RESULT: n/n passed" means all good; any "FAIL ..." line names the broken check.
-- It uses the real founder rows in public.members and, where a founder already has a real sign-in, that
-- account; otherwise it creates a confirmed fake account for the founder's email inside the transaction.
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
  v_stranger uuid := gen_random_uuid();
  v_audit_before bigint;
  v_wk date := date '2026-09-07'; -- a Monday
  v_changes jsonb;
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
  insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_stranger, 'stranger-docs@example.com', now(), 'authenticated', 'authenticated');

  -- Seed as the database owner: Chris has one shared and one private doc, Aaron has one private doc.
  insert into public.docs (id, folder, title, slug, body_md, visibility, owner, source_path) values
    ('rls-doc-chris-private', 'Plan', 'RLS test: Chris private', 'rls-test-chris-private', 'SECRET-CHRIS-PLAN', 'private', v_chris_mid, 'x/PLAN.md'),
    ('rls-doc-chris-shared', 'Decisions', 'RLS test: Chris shared', 'rls-test-chris-shared', 'shared body', 'shared', v_chris_mid, 'x/TERMS.md'),
    ('rls-doc-aaron-private', 'Plan', 'RLS test: Aaron private', 'rls-test-aaron-private', 'SECRET-AARON-NOTES', 'private', v_aaron_mid, null);
  insert into public.hours (id, member_id, week_start, hours, note) values ('rls-hours-chris', v_chris_mid, v_wk, 12.5, 'seed');

  -- 1. Anonymous: nothing
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    execute 'select count(*) from public.docs' into v_n;
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL anon: read docs')::text);
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute 'select count(*) from public.hours' into v_n;
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL anon: read hours')::text);
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute format('insert into public.hours (member_id, week_start, hours) values (%L, %L, 1)', v_chris_mid, v_wk + 7);
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL anon: wrote hours')::text);
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'reset role';

  -- 2. Signed in but not a founder: sees nothing, writes nothing
  perform set_config('request.jwt.claims', json_build_object('sub', v_stranger, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute 'select count(*) from public.docs' into v_n;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, (('FAIL outsider: sees ' || v_n || ' docs'))::text); end if;
  execute 'select count(*) from public.hours' into v_n;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL outsider: sees hours')::text); end if;
  begin
    execute format('insert into public.hours (member_id, week_start, hours) values (%L, %L, 1)', v_chris_mid, v_wk + 7);
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL outsider: wrote hours as Chris')::text);
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'reset role';

  -- 3. Aaron: shared docs and his own private doc, never Chris's private doc
  perform set_config('request.jwt.claims', json_build_object('sub', v_aaron, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute 'select count(*) from public.docs where slug like ''rls-test-%''' into v_n;
  if v_n = 2 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, (('FAIL aaron: sees ' || v_n || ' of the 2 docs he may see'))::text); end if;
  execute 'select count(*) from public.docs where id = ''rls-doc-chris-private''' into v_n;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL aaron: read Chris''s private doc by id')::text); end if;
  execute 'select count(*) from public.docs where slug = ''rls-test-chris-private''' into v_n;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL aaron: read Chris''s private doc by slug')::text); end if;
  execute 'select count(*) from public.docs where body_md ilike ''%SECRET-CHRIS%'' or title ilike ''%Chris private%''' into v_n;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL aaron: found Chris''s private text by searching')::text); end if;
  execute 'select count(*) from public.docs where visibility = ''private'' and owner = ' || quote_literal(v_chris_mid) into v_n;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL aaron: listed private docs owned by Chris')::text); end if;
  execute 'select count(*) from public.docs where id = ''rls-doc-aaron-private''' into v_n;
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL aaron: cannot read his own private doc')::text); end if;
  execute 'select count(*) from public.docs where id = ''rls-doc-chris-shared''' into v_n;
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL aaron: cannot read a shared doc')::text); end if;
  -- no writes to docs from the app, in any form
  begin
    execute format('insert into public.docs (folder, title, slug, owner) values (''Plan'', ''x'', ''rls-test-new'', %L)', v_aaron_mid);
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL aaron: inserted a doc from the app')::text);
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute 'update public.docs set visibility = ''shared'' where id = ''rls-doc-chris-private''';
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL aaron: shared Chris''s private doc')::text);
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute 'update public.docs set body_md = ''x'' where id = ''rls-doc-aaron-private''';
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL aaron: edited a doc from the app')::text);
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute 'delete from public.docs where id = ''rls-doc-chris-shared''';
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL aaron: deleted a doc from the app')::text);
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'reset role';

  -- 4. Chris: his shared and private docs, never Aaron's private doc
  perform set_config('request.jwt.claims', json_build_object('sub', v_chris, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute 'select count(*) from public.docs where slug like ''rls-test-%''' into v_n;
  if v_n = 2 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, (('FAIL chris: sees ' || v_n || ' of the 2 docs he may see'))::text); end if;
  execute 'select count(*) from public.docs where id = ''rls-doc-aaron-private''' into v_n;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL chris: read Aaron''s private doc')::text); end if;
  execute 'select count(*) from public.docs where id = ''rls-doc-chris-private''' into v_n;
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL chris: cannot read his own private doc')::text); end if;
  begin
    execute 'update public.docs set visibility = ''shared'' where id = ''rls-doc-chris-private''';
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL chris: changed a doc from the app')::text);
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'reset role';

  -- 5. Hours: everyone in the studio reads all rows; each founder writes only their own
  perform set_config('request.jwt.claims', json_build_object('sub', v_aaron, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute 'select count(*) from public.hours where id = ''rls-hours-chris''' into v_n;
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL hours: Aaron cannot read Chris''s hours')::text); end if;
  execute format('insert into public.hours (member_id, week_start, hours, note) values (%L, %L, 9, ''mine'')', v_aaron_mid, v_wk);
  v_pass := v_pass + 1;
  begin
    execute format('insert into public.hours (member_id, week_start, hours) values (%L, %L, 5)', v_chris_mid, v_wk + 7);
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL hours: Aaron logged hours for Chris')::text);
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'update public.hours set hours = 1 where id = ''rls-hours-chris''';
  get diagnostics v_n = row_count;
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL hours: Aaron edited Chris''s hours')::text); end if;
  execute format('update public.hours set hours = 10.5 where member_id = %L and week_start = %L', v_aaron_mid, v_wk);
  get diagnostics v_n = row_count;
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL hours: Aaron could not edit his own')::text); end if;
  begin
    execute format('update public.hours set member_id = %L where id = ''rls-hours-chris''', v_aaron_mid);
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL hours: member_id is editable')::text);
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute format('insert into public.hours (member_id, week_start, hours) values (%L, %L, 3)', v_aaron_mid, v_wk);
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL hours: two rows for the same member and week')::text);
  exception when unique_violation then v_pass := v_pass + 1;
  end;
  begin
    execute format('insert into public.hours (member_id, week_start, hours) values (%L, %L, 3)', v_aaron_mid, v_wk + 8);
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL hours: a week that is not a Monday was accepted')::text);
  exception when check_violation then v_pass := v_pass + 1;
  end;
  begin
    execute format('insert into public.hours (member_id, week_start, hours) values (%L, %L, 169)', v_aaron_mid, v_wk + 14);
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL hours: more than 168 hours in a week accepted')::text);
  exception when check_violation then v_pass := v_pass + 1;
  end;
  begin
    execute 'delete from public.hours where id = ''rls-hours-chris''';
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL hours: deleted from the app')::text);
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  begin
    execute 'update public.hours set hours = 2, actor = ''spoof'' where member_id = ' || quote_literal(v_aaron_mid);
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL hours: a founder could set actor')::text);
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'reset role';
  select count(*) into v_n from public.audit_log where id > v_audit_before and table_name = 'hours' and who = 'aaron' and via = 'app';
  if v_n >= 2 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL hours: edits not recorded as Aaron')::text); end if;

  -- 6. Agents (service_role): read and write docs, labelled, and the audit log never exposes a private doc or any body
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  execute 'select count(*) from public.docs where slug like ''rls-test-%''' into v_n;
  if v_n = 3 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL agent: cannot read all docs')::text); end if;
  execute 'update public.docs set body_md = ''shared body v2'', actor = ''claude-code:chris'' where id = ''rls-doc-chris-shared''';
  execute 'update public.docs set body_md = ''SECRET-CHRIS-PLAN v2'', actor = ''claude-code:chris'' where id = ''rls-doc-chris-private''';
  execute 'reset role';
  select count(*) into v_n from public.docs where id = 'rls-doc-chris-shared' and actor is null and updated_by = 'claude-code:chris';
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL agent: doc write not labelled or actor not cleared')::text); end if;
  select count(*) into v_n from public.audit_log where id > v_audit_before and table_name = 'docs' and row_id in ('rls-doc-chris-private', 'rls-doc-aaron-private');
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL audit: a private doc was logged')::text); end if;
  select count(*) into v_n from public.audit_log where id > v_audit_before and table_name = 'docs' and row_id = 'rls-doc-chris-shared' and via = 'claude-code:chris';
  if v_n >= 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL audit: shared doc changes not logged with the actor')::text); end if;
  select count(*) into v_n from public.audit_log where id > v_audit_before and table_name = 'docs' and changes::text ilike '%body_md%';
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL audit: a doc body reached the audit log')::text); end if;
  select count(*) into v_n from public.audit_log where id > v_audit_before and table_name = 'docs' and (changes::text ilike '%shared body%' or changes::text ilike '%SECRET%');
  if v_n = 0 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL audit: doc text reached the audit log')::text); end if;
  -- making a private doc shared is logged (both founders can then see it), as metadata only
  update public.docs set visibility = 'shared' where id = 'rls-doc-chris-private';
  select changes into v_changes from public.audit_log where id > v_audit_before and row_id = 'rls-doc-chris-private' and op = 'update' order by id desc limit 1;
  if v_changes is not null and v_changes ? 'visibility' and not (v_changes ? 'body_md') then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL audit: sharing a doc not logged as metadata')::text); end if;
  -- ...and from then on Aaron can read it
  perform set_config('request.jwt.claims', json_build_object('sub', v_aaron, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute 'select count(*) from public.docs where id = ''rls-doc-chris-private''' into v_n;
  execute 'reset role';
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL sharing: a doc made shared is still hidden from Aaron')::text); end if;
  -- the database owner label for the app role cannot write docs even by guessing a role claim
  perform set_config('request.jwt.claims', json_build_object('sub', v_aaron, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute 'truncate public.docs';
    v_fail := v_fail + 1; v_out := array_append(v_out, ('FAIL truncate: docs truncated')::text);
  exception when insufficient_privilege then v_pass := v_pass + 1;
  end;
  execute 'reset role';

  raise exception 'RLS RESULT: %/% passed%', v_pass, v_pass + v_fail,
    case when v_fail = 0 then '' else E'\n' || array_to_string(v_out, E'\n') end;
end
$$;
