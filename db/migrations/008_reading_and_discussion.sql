-- =====================================================================
-- 008: Reading in progress, and a discussion on each prompt
--
-- Reading: a book on your "considering" list can be marked as being read,
-- with an approximate percentage. Logging it as read still takes it off
-- the list, as before.
-- Discussion: one chat thread per prompt. A message can be about one of
-- the books, and can be marked as containing spoilers.
--
-- Additive only: safe to apply before or after the API that uses it is
-- deployed. Run once in the Neon SQL Editor (or with psql).
-- =====================================================================

alter table considerations
  add column status     text not null default 'considering' check (status in ('considering', 'reading')),
  add column progress   smallint check (progress between 0 and 100),
  add column started_on date;

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

alter table prompt_messages      enable row level security;
alter table prompt_message_reads enable row level security;

-- Anyone who can see the challenge sees the discussion (drafts too, so organisers and
-- admins can talk through how to word a prompt). You write and edit only as yourself;
-- you delete your own messages, and the challenge's organiser or a group admin can
-- delete any.
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

create policy prompt_message_reads_select on prompt_message_reads for select using (user_id = (select current_user_id()));
create policy prompt_message_reads_insert on prompt_message_reads for insert with check (user_id = (select current_user_id()));
create policy prompt_message_reads_update on prompt_message_reads for update
  using (user_id = (select current_user_id())) with check (user_id = (select current_user_id()));

grant select, insert, update, delete on prompt_messages, prompt_message_reads to app_user;
