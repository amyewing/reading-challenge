-- Migration 002: switch from Neon's Data API to our own API.
-- Run once in the Neon SQL Editor on a database created by the earlier schema.

-- The API's restricted role
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end $$;
grant app_user to current_user;

-- The signed-in user's Kinde id for this request (set by the API)
create or replace function current_user_id() returns text
language sql stable security invoker as $$
  select nullif(current_setting('app.user_id', true), '');
$$;
-- ---------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so policies don't recurse)
-- ---------------------------------------------------------------------

create or replace function is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members where group_id = gid and user_id = current_user_id()
  );
$$;

create or replace function is_group_admin(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = current_user_id() and role in ('owner', 'admin')
  );
$$;

create or replace function is_group_owner(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = current_user_id() and role = 'owner'
  );
$$;

create or replace function challenge_group(cid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from challenges where id = cid;
$$;

create or replace function can_manage_challenge(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from challenges c
    where c.id = cid
      and (c.created_by = current_user_id() or is_group_admin(c.group_id))
  );
$$;

create or replace function shares_group_with(other text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from group_members a
    join group_members b on a.group_id = b.group_id
    where a.user_id = current_user_id() and b.user_id = other
  );
$$;

-- ---------------------------------------------------------------------
-- Actions the app calls (RPC). These do multi-step work atomically.
-- ---------------------------------------------------------------------

-- Create or refresh the signed-in user's profile (called after login)
create or replace function upsert_profile(p_display_name text, p_email text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := current_user_id();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  insert into profiles (id, display_name, email)
  values (uid, coalesce(nullif(trim(p_display_name), ''), 'Reader'), p_email)
  on conflict (id) do update
    set display_name = excluded.display_name,
        email        = excluded.email,
        updated_at   = now();
end;
$$;

-- Create a group; the creator becomes its owner
create or replace function create_group(p_name text, p_description text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid text := current_user_id(); gid uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  insert into groups (name, description, created_by)
  values (trim(p_name), nullif(trim(p_description), ''), uid)
  returning id into gid;
  insert into group_members (group_id, user_id, role) values (gid, uid, 'owner');
  return gid;
end;
$$;

-- Owners/admins create a shareable invite link code
create or replace function create_invite(p_group_id uuid, p_days int default 14)
returns text language plpgsql security definer set search_path = public as $$
declare new_code text;
begin
  if not is_group_admin(p_group_id) then raise exception 'Only group admins can invite'; end if;
  insert into group_invites (group_id, created_by, expires_at)
  values (p_group_id, current_user_id(), now() + make_interval(days => greatest(1, least(p_days, 90))))
  returning code into new_code;
  return new_code;
end;
$$;

-- Lets a signed-in invitee see which group a code is for before joining
create or replace function get_invite(p_code text)
returns table (group_id uuid, group_name text, member_count int, already_member boolean, is_valid boolean)
language sql stable security definer set search_path = public as $$
  select g.id,
         g.name,
         (select count(*)::int from group_members m where m.group_id = g.id),
         is_group_member(g.id),
         (i.revoked_at is null and i.expires_at > now())
  from group_invites i
  join groups g on g.id = i.group_id
  where i.code = p_code and current_user_id() is not null;
$$;

-- Join a group using an invite code
create or replace function accept_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid text := current_user_id(); gid uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select i.group_id into gid
  from group_invites i
  where i.code = p_code and i.revoked_at is null and i.expires_at > now();
  if gid is null then raise exception 'This invite link is invalid or has expired'; end if;
  insert into group_members (group_id, user_id, role)
  values (gid, uid, 'member')
  on conflict do nothing;
  return gid;
end;
$$;

-- Create a challenge and its prompts in one step (any group member)
create or replace function create_challenge(
  p_group_id    uuid,
  p_title       text,
  p_description text,
  p_starts_on   date,
  p_ends_on     date,
  p_prompts     text[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if not is_group_member(p_group_id) then raise exception 'You are not in this group'; end if;
  insert into challenges (group_id, title, description, starts_on, ends_on, created_by)
  values (p_group_id, trim(p_title), nullif(trim(p_description), ''), p_starts_on, p_ends_on, current_user_id())
  returning id into cid;
  insert into prompts (challenge_id, position, title)
  select cid, ord, trim(t)
  from unnest(p_prompts) with ordinality as x(t, ord)
  where length(trim(t)) > 0;
  return cid;
end;
$$;

-- Add a book to the shared catalog (or reuse it), returning its id
create or replace function upsert_book(
  p_title           text,
  p_author          text default null,
  p_cover_url       text default null,
  p_open_library_key text default null,
  p_first_published int  default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if current_user_id() is null then raise exception 'Not signed in'; end if;
  if p_open_library_key is not null then
    insert into books (title, author, cover_url, open_library_key, first_published, created_by)
    values (trim(p_title), p_author, p_cover_url, p_open_library_key, p_first_published, current_user_id())
    on conflict (open_library_key) do update
      set cover_url = coalesce(books.cover_url, excluded.cover_url)
    returning id into bid;
  else
    select id into bid from books
    where open_library_key is null
      and lower(title) = lower(trim(p_title))
      and lower(coalesce(author, '')) = lower(coalesce(trim(p_author), ''))
    limit 1;
    if bid is null then
      insert into books (title, author, created_by)
      values (trim(p_title), nullif(trim(p_author), ''), current_user_id())
      returning id into bid;
    end if;
  end if;
  return bid;
end;
$$;


grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant execute on all functions in schema public to app_user;

-- The Data API roles no longer need access
revoke all on all tables in schema public from anonymous, authenticated;
revoke all on all functions in schema public from anonymous, authenticated;
revoke usage on schema public from anonymous, authenticated;

select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosrc like '%auth.%') as functions_still_using_auth,
  (select count(*) from pg_policies where schemaname = 'public' and (qual like '%auth.%' or with_check like '%auth.%')) as policies_still_using_auth;