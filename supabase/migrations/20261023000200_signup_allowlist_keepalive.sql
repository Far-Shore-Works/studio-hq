-- Only the two founder emails can create an auth user (magic link or GitHub). Enabled in the dashboard:
-- Authentication > Hooks > Before User Created > Postgres > public.hook_before_user_created.
create function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.members m where m.email = lower(coalesce(event -> 'user' ->> 'email', ''))) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Studio HQ is private. This email is not on the founders list.'));
end
$$;
revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- A harmless read for the keep-alive workflow (free projects pause after 7 idle days). Returns true.
create function public.keepalive() returns boolean
language sql stable security invoker set search_path = ''
as $$ select true $$;
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
