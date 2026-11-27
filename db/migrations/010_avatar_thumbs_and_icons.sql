-- =====================================================================
-- 010: Small profile pictures for lists, and literary icons
--
-- avatar_thumb: a tiny (64 px) copy of the profile picture, so lists of
--   people (group members, challenge progress) stay light. Lists use it
--   when there is one and fall back to the full picture.
-- avatar_preset: the key of a built-in literary icon (open book, quill,
--   owl...) chosen instead of uploading a photo. The app knows what each
--   key looks like.
--
-- Additive only: safe to apply before or after the API that uses it is
-- deployed (apply it first). Run once in the Neon SQL Editor (or with psql).
-- =====================================================================

alter table profiles
  add column avatar_thumb  text check (avatar_thumb is null or (avatar_thumb like 'data:image/jpeg;base64,%' and length(avatar_thumb) <= 12000)),
  add column avatar_preset text check (avatar_preset is null or avatar_preset ~ '^[a-z-]{1,30}$');
