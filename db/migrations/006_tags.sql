-- =====================================================================
-- 006: Tags on books
--
-- People tag books (genre, mood, pace, ...) from a suggested library and
-- can add their own tags. Each person's tags are kept separately, so a
-- book's tags show how many people chose each one.
--
-- Safe to apply before or after the API that uses it is deployed.
-- After this, run db/tags_seed.sql to load the suggested tags.
-- =====================================================================

create table tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 40),
  -- lower-case name used to stop near-duplicates ("Cozy" vs "cozy ")
  slug        text not null unique,
  -- genre, mood, pace, story, theme, format, content, custom
  category    text not null default 'custom'
              check (category in ('genre', 'mood', 'pace', 'story', 'theme', 'format', 'content', 'custom')),
  suggested   boolean not null default false,
  position    int,                                   -- order within the suggested library
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

alter table tags enable row level security;
alter table book_tags enable row level security;

-- Any signed-in person sees the tag library and how books are tagged (as counts in the app).
-- People add their own tags (never "suggested" ones) and tag books only as themselves.
create policy tags_select on tags for select using ((select current_user_id()) is not null);
create policy tags_insert on tags for insert
  with check (created_by = (select current_user_id()) and suggested = false and category = 'custom');

create policy book_tags_select on book_tags for select using ((select current_user_id()) is not null);
create policy book_tags_insert on book_tags for insert with check (user_id = (select current_user_id()));
create policy book_tags_delete on book_tags for delete using (user_id = (select current_user_id()));

grant select, insert on tags to app_user;
grant select, insert, delete on book_tags to app_user;
