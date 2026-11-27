-- =====================================================================
-- 009: Editable profiles, and discussions that belong to a book
--
-- Profiles: people can set their own display name (kept when they sign in
-- again), add a small profile picture, and feature a book with a note on
-- why. The picture is stored as a small JPEG data URL (the app shrinks it
-- to about 256x256 before saving).
-- Discussions: a message about a book now lives in that book's own thread
-- under the prompt (prompt_messages.book_id was already there). Read
-- markers are therefore kept per prompt and book, so "new" counts work for
-- each thread.
--
-- Run once in the Neon SQL Editor (or with psql), BEFORE deploying the API
-- that uses it. Needs PostgreSQL 15 or newer (NULLS NOT DISTINCT).
-- =====================================================================

alter table profiles
  add column display_name_custom boolean not null default false,
  add column avatar              text check (avatar is null or (avatar like 'data:image/jpeg;base64,%' and length(avatar) <= 80000)),
  add column featured_book_id    uuid references books(id) on delete set null,
  add column featured_note       text check (featured_note is null or length(featured_note) <= 1000);

-- Sign-in still refreshes the email, but keeps a name the person chose themselves
create or replace function upsert_profile(p_display_name text, p_email text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := current_user_id();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  insert into profiles (id, display_name, email)
  values (uid, coalesce(nullif(trim(p_display_name), ''), 'Reader'), p_email)
  on conflict (id) do update
    set display_name = case when profiles.display_name_custom then profiles.display_name else excluded.display_name end,
        email        = excluded.email,
        updated_at   = now();
end;
$$;

-- Read markers per thread: book_id is null for the prompt's general thread
alter table prompt_message_reads add column book_id uuid references books(id) on delete cascade;
alter table prompt_message_reads drop constraint prompt_message_reads_pkey;
alter table prompt_message_reads
  add constraint prompt_message_reads_unique unique nulls not distinct (prompt_id, user_id, book_id);

-- Carry over what people had already read, so no thread suddenly looks new
insert into prompt_message_reads (prompt_id, user_id, last_read_at, book_id)
select r.prompt_id, r.user_id, r.last_read_at, b.book_id
from prompt_message_reads r
join (select distinct prompt_id, book_id from prompt_messages where book_id is not null) b
  on b.prompt_id = r.prompt_id
where r.book_id is null;
