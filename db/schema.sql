-- =====================================================================
-- Reading Challenge — database schema (Postgres on Neon)
--
-- Run this once in the Neon SQL Editor on an empty database, then run
-- db/tags_seed.sql to load the suggested tags.
--
-- Only our API (api/) talks to the database. It checks the Kinde sign-in
-- token, then runs each request inside a transaction as the restricted
-- `app_user` role with the verified Kinde user id in `app.user_id`.
-- The Row Level Security (RLS) rules below are a second layer of
-- protection behind the API's own checks.
-- =====================================================================

-- The signed-in user's Kinde id for this request (set by the API)
create or replace function current_user_id() returns text
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '');
$$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table profiles (
  id            text primary key default current_user_id(),   -- Kinde user id
  display_name  text not null,
  email         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) between 1 and 100),
  description  text,
  created_by   text not null default current_user_id() references profiles(id),
  created_at   timestamptz not null default now()
);

create table group_members (
  group_id   uuid not null references groups(id) on delete cascade,
  user_id    text not null references profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on group_members (user_id);

create table group_invites (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  code        text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  created_by  text not null default current_user_id() references profiles(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  revoked_at  timestamptz
);
create index group_invites_group_idx on group_invites (group_id);

create table challenges (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references groups(id) on delete cascade,
  title        text not null check (length(trim(title)) between 1 and 150),
  description  text,
  starts_on    date,
  ends_on      date,
  created_by   text not null default current_user_id() references profiles(id),
  created_at   timestamptz not null default now(),
  -- 'draft': only the creator and group admins can see it; nobody can log books yet.
  -- 'active': launched — the whole group sees it and can log books.
  status       text not null default 'draft' check (status in ('draft', 'active')),
  launched_at  timestamptz,
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);
create index challenges_group_idx on challenges (group_id);

create table prompts (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references challenges(id) on delete cascade,
  position      int  not null default 0,
  title         text not null check (length(trim(title)) between 1 and 300),
  description   text,
  created_at    timestamptz not null default now()
);
create index prompts_challenge_idx on prompts (challenge_id, position);

-- Shared book catalog (filled from Open Library or typed in by hand)
create table books (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  author            text,
  cover_url         text,
  open_library_key  text unique,
  first_published   int,
  created_by        text default current_user_id() references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- A person logging a book against one prompt of a challenge
-- (several different books can count toward the same prompt)
create table entries (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references challenges(id) on delete cascade,
  prompt_id     uuid not null references prompts(id) on delete cascade,
  user_id       text not null default current_user_id() references profiles(id) on delete cascade,
  book_id       uuid not null references books(id),
  finished_on   date,
  rating        smallint check (rating between 1 and 5),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint entries_prompt_user_book_key unique (prompt_id, user_id, book_id)
);
create index entries_challenge_idx on entries (challenge_id);

-- Books a person is considering for a prompt while they plan, with why
create table considerations (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references challenges(id) on delete cascade,
  prompt_id     uuid not null references prompts(id) on delete cascade,
  user_id       text not null default current_user_id() references profiles(id) on delete cascade,
  book_id       uuid not null references books(id),
  reason        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- 'reading': you've started it; progress is an approximate percentage
  status        text not null default 'considering' check (status in ('considering', 'reading')),
  progress      smallint check (progress between 0 and 100),
  started_on    date,
  unique (prompt_id, user_id, book_id)
);
create index considerations_challenge_idx on considerations (challenge_id);

-- One discussion thread per prompt; a message can be about one of the books
create table prompt_messages (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references challenges(id) on delete cascade,
  prompt_id     uuid not null references prompts(id) on delete cascade,
  user_id       text not null default current_user_id() references profiles(id) on delete cascade,
  book_id       uuid references books(id),
  body          text not null check (length(trim(body)) between 1 and 4000),
  spoiler       boolean not null default false,
  created_at    timestamptz not null default now(),
  edited_at     timestamptz
);
create index prompt_messages_prompt_idx on prompt_messages (prompt_id, created_at);
create index prompt_messages_challenge_idx on prompt_messages (challenge_id);

-- When each person last opened a prompt's discussion (drives "new" counts)
create table prompt_message_reads (
  prompt_id     uuid not null references prompts(id) on delete cascade,
  user_id       text not null default current_user_id() references profiles(id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (prompt_id, user_id)
);

-- Tag library: suggested tags (see db/tags_seed.sql) plus tags people add
create table tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 40),
  slug        text not null unique,                          -- lower-case name, stops near-duplicates
  category    text not null default 'custom'
              check (category in ('genre', 'mood', 'pace', 'story', 'theme', 'format', 'content', 'custom')),
  suggested   boolean not null default false,
  position    int,                                           -- order within the suggested library
  created_by  text default current_user_id() references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- One person putting one tag on one book
create table book_tags (
  book_id     uuid not null references books(id) on delete cascade,
  tag_id      uuid not null references tags(id) on delete cascade,
  user_id     text not null default current_user_id() references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (book_id, tag_id, user_id)
);
create index book_tags_tag_idx on book_tags (tag_id);
create index book_tags_user_idx on book_tags (user_id);

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

-- Can the current user see this challenge (and its prompts)?
-- Launched challenges: any group member. Drafts: the creator and group admins.
create or replace function challenge_visible(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from challenges c
    where c.id = cid
      and is_group_member(c.group_id)
      and (c.status = 'active' or c.created_by = current_user_id() or is_group_admin(c.group_id))
  );
$$;

create or replace function challenge_is_active(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from challenges where id = cid and status = 'active');
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

-- Hand a group to another member: they become owner, the old owner an admin
create or replace function transfer_group(p_group_id uuid, p_new_owner text)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := current_user_id();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not is_group_owner(p_group_id) then raise exception 'Only the group''s owner can hand it over'; end if;
  if p_new_owner = uid then raise exception 'You already own this group'; end if;
  if not exists (select 1 from group_members where group_id = p_group_id and user_id = p_new_owner) then
    raise exception 'The new owner must be a member of the group';
  end if;
  update group_members set role = 'admin' where group_id = p_group_id and user_id = uid;
  update group_members set role = 'owner' where group_id = p_group_id and user_id = p_new_owner;
end;
$$;

-- Hand a challenge to another group member (its organiser, challenges.created_by)
create or replace function transfer_challenge(p_challenge_id uuid, p_new_owner text)
returns void language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if current_user_id() is null then raise exception 'Not signed in'; end if;
  if not can_manage_challenge(p_challenge_id) then
    raise exception 'Only the challenge''s organiser or a group admin can hand it over';
  end if;
  select group_id into gid from challenges where id = p_challenge_id;
  if not exists (select 1 from group_members where group_id = gid and user_id = p_new_owner) then
    raise exception 'The new organiser must be a member of the group';
  end if;
  update challenges set created_by = p_new_owner where id = p_challenge_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table profiles      enable row level security;
alter table groups        enable row level security;
alter table group_members enable row level security;
alter table group_invites enable row level security;
alter table challenges    enable row level security;
alter table prompts       enable row level security;
alter table books         enable row level security;
alter table entries       enable row level security;
alter table considerations enable row level security;
alter table prompt_messages enable row level security;
alter table prompt_message_reads enable row level security;
alter table tags          enable row level security;
alter table book_tags     enable row level security;

-- profiles: see yourself and people you share a group with; edit yourself
create policy profiles_select on profiles for select
  using (id = (select current_user_id()) or shares_group_with(id));
create policy profiles_update on profiles for update
  using (id = (select current_user_id())) with check (id = (select current_user_id()));

-- groups: members see; admins edit; owner deletes (creation via create_group)
create policy groups_select on groups for select using (is_group_member(id));
create policy groups_update on groups for update using (is_group_admin(id)) with check (is_group_admin(id));
create policy groups_delete on groups for delete using (is_group_owner(id));

-- group_members: members see the roster; joining is via create_group / accept_invite
create policy members_select on group_members for select using (is_group_member(group_id));
create policy members_delete on group_members for delete using (
  (user_id = (select current_user_id()) and role <> 'owner')      -- leave a group
  or (role <> 'owner' and is_group_owner(group_id))             -- owner removes anyone else
  or (role = 'member' and is_group_admin(group_id))             -- admins remove members
);
create policy members_update on group_members for update
  using (role <> 'owner' and is_group_owner(group_id))
  with check (role in ('admin', 'member') and is_group_owner(group_id));

-- group_invites: admins see and revoke (creation via create_invite)
create policy invites_select on group_invites for select using (is_group_admin(group_id));
create policy invites_update on group_invites for update
  using (is_group_admin(group_id)) with check (is_group_admin(group_id));

-- challenges: members see launched ones (drafts: creator and admins only);
-- members create; creator or admins edit/delete
create policy challenges_select on challenges for select using (
  is_group_member(group_id)
  and (status = 'active' or created_by = (select current_user_id()) or is_group_admin(group_id))
);
create policy challenges_insert on challenges for insert
  with check (created_by = (select current_user_id()) and is_group_member(group_id));
create policy challenges_update on challenges for update
  using (can_manage_challenge(id)) with check (is_group_member(group_id));
create policy challenges_delete on challenges for delete using (can_manage_challenge(id));

-- prompts: visible with their challenge; challenge creator or admins manage
create policy prompts_select on prompts for select using (challenge_visible(challenge_id));
create policy prompts_insert on prompts for insert with check (can_manage_challenge(challenge_id));
create policy prompts_update on prompts for update
  using (can_manage_challenge(challenge_id)) with check (can_manage_challenge(challenge_id));
create policy prompts_delete on prompts for delete using (can_manage_challenge(challenge_id));

-- books: any signed-in user can read the catalog (writes via upsert_book)
create policy books_select on books for select using ((select current_user_id()) is not null);

-- entries: group members see everyone's; you manage only your own;
-- books can only be logged against launched challenges
create policy entries_select on entries for select using (is_group_member(challenge_group(challenge_id)));
create policy entries_insert on entries for insert with check (
  user_id = (select current_user_id())
  and is_group_member(challenge_group(challenge_id))
  and challenge_is_active(challenge_id)
  and exists (select 1 from prompts p where p.id = prompt_id and p.challenge_id = entries.challenge_id)
);
create policy entries_update on entries for update
  using (user_id = (select current_user_id()))
  with check (
    user_id = (select current_user_id())
    and challenge_is_active(challenge_id)
    and exists (select 1 from prompts p where p.id = prompt_id and p.challenge_id = entries.challenge_id)
  );
create policy entries_delete on entries for delete using (user_id = (select current_user_id()));

-- considerations: anyone who can see the challenge sees everyone's lists; you manage
-- only your own. Allowed on drafts too, so a challenge's creator can plan while writing it.
create policy considerations_select on considerations for select using (challenge_visible(challenge_id));
create policy considerations_insert on considerations for insert with check (
  user_id = (select current_user_id())
  and challenge_visible(challenge_id)
  and exists (select 1 from prompts p where p.id = prompt_id and p.challenge_id = considerations.challenge_id)
);
create policy considerations_update on considerations for update
  using (user_id = (select current_user_id()))
  with check (
    user_id = (select current_user_id())
    and challenge_visible(challenge_id)
    and exists (select 1 from prompts p where p.id = prompt_id and p.challenge_id = considerations.challenge_id)
  );
create policy considerations_delete on considerations for delete using (user_id = (select current_user_id()));

-- prompt_messages: anyone who can see the challenge sees its discussions (drafts too, so
-- organisers and admins can talk through how to word a prompt). You write and edit only as
-- yourself; you delete your own messages, and the organiser or a group admin can delete any.
create policy prompt_messages_select on prompt_messages for select using (challenge_visible(challenge_id));
create policy prompt_messages_insert on prompt_messages for insert with check (
  user_id = (select current_user_id())
  and challenge_visible(challenge_id)
  and exists (select 1 from prompts p where p.id = prompt_id and p.challenge_id = prompt_messages.challenge_id)
);
create policy prompt_messages_update on prompt_messages for update
  using (user_id = (select current_user_id()))
  with check (
    user_id = (select current_user_id())
    and challenge_visible(challenge_id)
    and exists (select 1 from prompts p where p.id = prompt_id and p.challenge_id = prompt_messages.challenge_id)
  );
create policy prompt_messages_delete on prompt_messages for delete using (
  user_id = (select current_user_id()) or can_manage_challenge(challenge_id)
);

-- prompt_message_reads: only your own
create policy prompt_message_reads_select on prompt_message_reads for select using (user_id = (select current_user_id()));
create policy prompt_message_reads_insert on prompt_message_reads for insert with check (user_id = (select current_user_id()));
create policy prompt_message_reads_update on prompt_message_reads for update
  using (user_id = (select current_user_id())) with check (user_id = (select current_user_id()));

-- tags / book_tags: any signed-in person sees the library and how books are tagged;
-- people add their own (never "suggested") tags and tag books only as themselves
create policy tags_select on tags for select using ((select current_user_id()) is not null);
create policy tags_insert on tags for insert
  with check (created_by = (select current_user_id()) and suggested = false and category = 'custom');
create policy book_tags_select on book_tags for select using ((select current_user_id()) is not null);
create policy book_tags_insert on book_tags for insert with check (user_id = (select current_user_id()));
create policy book_tags_delete on book_tags for delete using (user_id = (select current_user_id()));

-- ---------------------------------------------------------------------
-- The API's restricted role
--
-- The API connects as the database owner, then for each request switches
-- to `app_user` (which these rules apply to) and sets app.user_id.
-- ---------------------------------------------------------------------

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end $$;
grant app_user to current_user;

grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant execute on all functions in schema public to app_user;
