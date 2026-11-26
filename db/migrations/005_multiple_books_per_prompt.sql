-- =====================================================================
-- 005: Several books can count toward the same prompt
--
-- Before: one logged book per person per prompt.
-- After:  any number of different books per person per prompt (the same
--         book can't be logged twice for one prompt).
--
-- Apply AFTER the API that no longer relies on the old one-per-prompt rule
-- is deployed: the old API's "on conflict (prompt_id, user_id)" needs it.
-- =====================================================================

alter table entries drop constraint entries_prompt_id_user_id_key;
alter table entries add constraint entries_prompt_user_book_key unique (prompt_id, user_id, book_id);
