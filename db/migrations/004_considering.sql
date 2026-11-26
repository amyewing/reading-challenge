-- =====================================================================
-- 004: "Considering" lists
--
-- While planning, people can note books they might read for a prompt,
-- with a reason, and see what everyone else is considering.
-- Run once in the Neon SQL Editor (or with psql) on the existing database.
-- =====================================================================

create table considerations (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references challenges(id) on delete cascade,
  prompt_id     uuid not null references prompts(id) on delete cascade,
  user_id       text not null default current_user_id() references profiles(id) on delete cascade,
  book_id       uuid not null references books(id),
  reason        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (prompt_id, user_id, book_id)
);
create index considerations_challenge_idx on considerations (challenge_id);

alter table considerations enable row level security;

-- Anyone who can see the challenge sees everyone's lists; you manage only your own.
-- Allowed on drafts too, so a challenge's creator can plan while writing it.
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

grant select, insert, update, delete on considerations to app_user;
