-- =====================================================================
-- 013: Remember who has seen the first-time tutorial
--
-- profiles.tutorial_seen_at: when the person closed the "how this site
--   works" guide. Null means they haven't seen it, so the app shows it
--   once. Everyone who already has a profile when this runs is marked as
--   having seen it (only brand-new people get the guide). New profiles
--   start with null because upsert_profile doesn't set the column.
--
-- To show the guide again to one person, in the Neon SQL Editor:
--   update profiles set tutorial_seen_at = null where email = 'their@email';
--
-- Additive only: apply it before the API that uses it is deployed.
-- Run once in the Neon SQL Editor (or with psql).
-- =====================================================================

alter table profiles add column tutorial_seen_at timestamptz;

update profiles set tutorial_seen_at = now();
