-- =====================================================================
-- 012: Uploaded book covers
--
-- A cover can also be a picture someone uploads (the app crops it to 300 x 450 and
-- sends a small JPEG). It is stored here, not in books, so lists of books stay light:
-- books.cover_url just holds its address ("/api/covers/<book id>?v=<time>"), and the API
-- serves the image from there without needing a sign-in (covers are not private, and
-- book ids can't be guessed).
--
-- Same rules as before: only a book with no cover can get one; after that only the person
-- who added it, or a site admin, can change or remove it. The app cannot touch this table
-- directly: only the functions below can.
--
-- Additive: safe to apply before or after the API that uses it (apply it first).
-- Run once in the Neon SQL Editor (or with psql).
-- =====================================================================

create table book_covers (
  book_id     uuid primary key references books(id) on delete cascade,
  image       text not null check (image like 'data:image/jpeg;base64,%' and length(image) <= 120000),
  created_at  timestamptz not null default now()
);
alter table book_covers enable row level security;   -- no policies: the app role sees nothing
revoke all on book_covers from app_user;

-- Upload a cover (only if the book has none, or you may manage its cover)
create or replace function upload_book_cover(p_book uuid, p_image text)
returns void language plpgsql security definer set search_path = public as $$
declare b books%rowtype;
begin
  if current_user_id() is null then raise exception 'Not signed in'; end if;
  if p_image is null or p_image !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' or length(p_image) > 120000 then
    raise exception 'That picture is not valid or is too large.';
  end if;
  select * into b from books where id = p_book for update;
  if not found then raise exception 'That book was not found.'; end if;
  if b.cover_url is not null and b.cover_added_by is distinct from current_user_id() and not is_site_admin() then
    raise exception 'This book already has a cover. Only the person who added it, or a site admin, can change it.';
  end if;
  insert into book_covers (book_id, image) values (p_book, p_image)
  on conflict (book_id) do update set image = excluded.image, created_at = now();
  -- a new address each time, so browsers don't keep showing the old picture
  update books
  set cover_url = '/api/covers/' || p_book::text || '?v=' || floor(extract(epoch from clock_timestamp()))::bigint::text,
      cover_added_by = current_user_id(), cover_updated_at = now()
  where id = p_book;
end;
$$;

-- Choosing an Open Library cover or removing the cover also drops any uploaded picture
create or replace function set_book_cover(p_book uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare b books%rowtype;
begin
  if current_user_id() is null then raise exception 'Not signed in'; end if;
  if p_url is null or p_url !~ '^https://covers\.openlibrary\.org/b/id/[0-9]{1,12}-M\.jpg$' then
    raise exception 'That cover is not valid.';
  end if;
  select * into b from books where id = p_book for update;
  if not found then raise exception 'That book was not found.'; end if;
  if b.cover_url is not null and b.cover_added_by is distinct from current_user_id() and not is_site_admin() then
    raise exception 'This book already has a cover. Only the person who added it, or a site admin, can change it.';
  end if;
  delete from book_covers where book_id = p_book;
  update books
  set cover_url = p_url, cover_added_by = current_user_id(), cover_updated_at = now()
  where id = p_book;
end;
$$;

create or replace function remove_book_cover(p_book uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b books%rowtype;
begin
  if current_user_id() is null then raise exception 'Not signed in'; end if;
  select * into b from books where id = p_book for update;
  if not found then raise exception 'That book was not found.'; end if;
  if b.cover_url is null then return; end if;
  if b.cover_added_by is distinct from current_user_id() and not is_site_admin() then
    raise exception 'Only the person who added this cover, or a site admin, can remove it.';
  end if;
  delete from book_covers where book_id = p_book;
  update books
  set cover_url = null, cover_added_by = null, cover_updated_at = now()
  where id = p_book;
end;
$$;

-- The uploaded picture for a book, for the public cover address (works without a signed-in user)
create or replace function book_cover_image(p_book uuid)
returns text language sql stable security definer set search_path = public as $$
  select image from book_covers where book_id = p_book;
$$;

revoke execute on function upload_book_cover(uuid, text) from public;
revoke execute on function book_cover_image(uuid) from public;
grant execute on function upload_book_cover(uuid, text) to app_user;
grant execute on function book_cover_image(uuid) to app_user;
