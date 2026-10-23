-- A founder can sign in from more than one address (members.alt_emails). Needed on day one because
-- Supabase's built-in mailer only delivers sign-in links to addresses that are members of the Supabase
-- organization, and a founder's Supabase login may use a different address than their studio email.
-- Membership is now decided by the signed-in account's current confirmed email, every time; user_id is
-- kept only as "the account that last signed in" (for the avatar).

begin;

alter table public.members add column alt_emails text[] not null default '{}'; -- store lowercase

create or replace function private.current_member_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.id
  from auth.users u
  join public.members m on m.email = lower(u.email) or lower(u.email) = any (m.alt_emails)
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null
  limit 1
$$;

create or replace function private.link_member() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is not null and new.email_confirmed_at is not null then
    update public.members m
       set user_id = new.id,
           avatar_url = coalesce(nullif(new.raw_user_meta_data ->> 'avatar_url', ''), m.avatar_url)
     where (m.email = lower(new.email) or lower(new.email) = any (m.alt_emails))
       and m.user_id is distinct from new.id;
  end if;
  return new;
end
$$;

create or replace function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_email text := lower(coalesce(event -> 'user' ->> 'email', ''));
begin
  if v_email <> '' and exists (select 1 from public.members m where m.email = v_email or v_email = any (m.alt_emails)) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Studio HQ is private. This email is not on the founders list.'));
end
$$;

-- user_id is informational now; a second account for the same founder may take it over.
alter table public.members drop constraint if exists members_user_id_key;

commit;
