-- =====================================================================
-- 007: Hand a group or a challenge over to someone else
--
-- Group: the owner makes another member the owner, and becomes an admin.
-- Challenge: whoever can manage it (its organiser or a group admin) makes
-- another group member its organiser (challenges.created_by).
--
-- Safe to apply before or after the API that uses it is deployed.
-- =====================================================================

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

revoke execute on function transfer_group(uuid, text) from public;
revoke execute on function transfer_challenge(uuid, text) from public;
grant execute on function transfer_group(uuid, text) to app_user;
grant execute on function transfer_challenge(uuid, text) to app_user;
