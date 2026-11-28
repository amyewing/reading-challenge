-- =====================================================================
-- 011: Site admins, and adding a cover to a book that has none
--
-- The book catalog is shared by every group, so a cover is added to the
-- book for everyone. Rules:
--   - A cover can only be ADDED to a book that has none.
--   - Once there is one, only the person who added it, or a site admin,
--     can change or remove it. (Covers that came from Open Library when the
--     book was first added have no "added by", so only site admins can
--     change those.)
--   - Removing a cover makes the book "missing" again, so anyone can add one.
-- Site admins are NOT group admins: they are a short list kept in the
-- database and added by hand. Nothing in the app can create one.
--
-- Add a site admin (find the person by their sign-in email):
--   insert into site_admins (user_id)
--   select id from profiles where lower(email) = lower('someone@example.com');
-- Remove one:
--   delete from site_admins
--   where user_id = (select id from profiles where lower(email) = lower('someone@example.com'));
--
-- Additive only: safe to apply before or after the API that uses it is
-- deployed (apply it first). Run once in the Neon SQL Editor (or with psql).
-- =====================================================================

create table site_admins (
  user_id   text primary key references profiles(id) on delete cascade,
  added_at  timestamptz not null default now()
);
alter table site_admins enable row level security;
-- You can see only your own row (to tell whether you are one); nobody can change the list from the app
create policy site_admins_select on site_admins for select using (user_id = (select current_user_id()));
revoke all on site_admins from app_user;
grant select on site_admins to app_user;

create or replace function is_site_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from site_admins where user_id = current_user_id());
$$;

alter table books
  add column cover_added_by   text references profiles(id) on delete set null,
  add column cover_updated_at timestamptz;

-- Choose a cover from Open Library for a book (only if it has none, or you may manage its cover)
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
  update books
  set cover_url = p_url, cover_added_by = current_user_id(), cover_updated_at = now()
  where id = p_book;
end;
$$;

-- Take a cover off a book (the person who added it, or a site admin)
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
  update books
  set cover_url = null, cover_added_by = null, cover_updated_at = now()
  where id = p_book;
end;
$$;

revoke execute on function set_book_cover(uuid, text) from public;
revoke execute on function remove_book_cover(uuid) from public;
revoke execute on function is_site_admin() from public;
grant execute on function set_book_cover(uuid, text) to app_user;
grant execute on function remove_book_cover(uuid) to app_user;
grant execute on function is_site_admin() to app_user;
