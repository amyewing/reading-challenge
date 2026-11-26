-- Migration 003: draft challenges that can be edited, then launched.
-- Run once in the Neon SQL Editor.

alter table challenges
  add column status text not null default 'draft' check (status in ('draft', 'active')),
  add column launched_at timestamptz;

-- Challenges created before this change were already in use: mark them launched.
update challenges set status = 'active', launched_at = created_at;

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

drop policy challenges_select on challenges;
create policy challenges_select on challenges for select using (
  is_group_member(group_id)
  and (status = 'active' or created_by = (select current_user_id()) or is_group_admin(group_id))
);

drop policy prompts_select on prompts;
create policy prompts_select on prompts for select using (challenge_visible(challenge_id));

alter policy entries_insert on entries with check (
  user_id = (select current_user_id())
  and is_group_member(challenge_group(challenge_id))
  and challenge_is_active(challenge_id)
  and exists (select 1 from prompts p where p.id = prompt_id and p.challenge_id = entries.challenge_id)
);
alter policy entries_update on entries
  using (user_id = (select current_user_id()))
  with check (
    user_id = (select current_user_id())
    and challenge_is_active(challenge_id)
    and exists (select 1 from prompts p where p.id = prompt_id and p.challenge_id = entries.challenge_id)
  );

-- The API now creates challenges itself (as drafts), so this is no longer used.
drop function if exists create_challenge(uuid, text, text, date, date, text[]);

grant execute on all functions in schema public to app_user;

select column_name, column_default from information_schema.columns
where table_name = 'challenges' and column_name in ('status', 'launched_at');
