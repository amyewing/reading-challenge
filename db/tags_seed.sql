-- =====================================================================
-- Suggested tags
--
-- A starter library drawn from what readers already use elsewhere:
--   genre   - Goodreads' genre list
--   mood    - StoryGraph's moods
--   pace    - StoryGraph's pace
--   story   - StoryGraph's "plot or character driven?" style questions
--   theme   - popular reader shelves and tropes
--   format  - length, form, how it's read
--   content - common content notes, useful when recommending to family
--
-- Safe to run again: existing tags are left alone, new ones are added.
-- People can add their own tags in the app (category 'custom').
-- =====================================================================

insert into tags (name, slug, category, suggested, position, created_by)
select name, lower(name), category, true, row_number() over (), null
from (values
  -- Genres
  ('Fiction', 'genre'), ('Nonfiction', 'genre'), ('Classics', 'genre'), ('Contemporary', 'genre'),
  ('Literary fiction', 'genre'), ('Historical fiction', 'genre'), ('Fantasy', 'genre'),
  ('Romantasy', 'genre'), ('Science fiction', 'genre'), ('Dystopian', 'genre'),
  ('Magical realism', 'genre'), ('Mystery', 'genre'), ('Cozy mystery', 'genre'), ('Thriller', 'genre'),
  ('Suspense', 'genre'), ('Crime', 'genre'), ('Horror', 'genre'), ('Paranormal', 'genre'),
  ('Romance', 'genre'), ('Historical romance', 'genre'), ('Women''s fiction', 'genre'),
  ('Western', 'genre'), ('Young adult', 'genre'), ('Middle grade', 'genre'), ('Children''s', 'genre'),
  ('Picture book', 'genre'), ('Graphic novel', 'genre'), ('Manga', 'genre'), ('Short stories', 'genre'),
  ('Poetry', 'genre'), ('Plays', 'genre'), ('Humor', 'genre'), ('Memoir', 'genre'),
  ('Biography', 'genre'), ('Autobiography', 'genre'), ('History', 'genre'), ('True crime', 'genre'),
  ('Science', 'genre'), ('Nature', 'genre'), ('Travel', 'genre'), ('Essays', 'genre'),
  ('Self help', 'genre'), ('Psychology', 'genre'), ('Philosophy', 'genre'), ('Religion', 'genre'),
  ('Christian', 'genre'), ('Spirituality', 'genre'), ('Business', 'genre'), ('Politics', 'genre'),
  ('Art', 'genre'), ('Music', 'genre'), ('Sports', 'genre'), ('Food & cooking', 'genre'),
  ('LGBTQ+', 'genre'),

  -- Moods
  ('Adventurous', 'mood'), ('Challenging', 'mood'), ('Dark', 'mood'), ('Emotional', 'mood'),
  ('Funny', 'mood'), ('Hopeful', 'mood'), ('Informative', 'mood'), ('Inspiring', 'mood'),
  ('Lighthearted', 'mood'), ('Mysterious', 'mood'), ('Reflective', 'mood'), ('Relaxing', 'mood'),
  ('Sad', 'mood'), ('Tense', 'mood'),

  -- Pace
  ('Slow-paced', 'pace'), ('Medium-paced', 'pace'), ('Fast-paced', 'pace'),

  -- Story
  ('Plot-driven', 'story'), ('Character-driven', 'story'), ('Strong character development', 'story'),
  ('Lovable characters', 'story'), ('Diverse cast', 'story'), ('Flawed characters', 'story'),
  ('Twist ending', 'story'), ('Unreliable narrator', 'story'), ('Multiple points of view', 'story'),

  -- Themes
  ('Cozy', 'theme'), ('Feel-good', 'theme'), ('Tearjerker', 'theme'), ('Coming of age', 'theme'),
  ('Family saga', 'theme'), ('Friendship', 'theme'), ('Found family', 'theme'), ('Grief', 'theme'),
  ('Faith', 'theme'), ('War', 'theme'), ('Small town', 'theme'), ('Retelling', 'theme'),
  ('Based on a true story', 'theme'), ('Strong female lead', 'theme'), ('Enemies to lovers', 'theme'),
  ('Second chance', 'theme'), ('Survival', 'theme'), ('Time travel', 'theme'), ('Book club pick', 'theme'),
  ('Award winner', 'theme'), ('Own voices', 'theme'), ('Clean read', 'theme'),

  -- Format
  ('Standalone', 'format'), ('Series', 'format'), ('Novella', 'format'), ('Short read', 'format'),
  ('Long read', 'format'), ('Translated', 'format'), ('Great on audio', 'format'),
  ('Illustrated', 'format'), ('Read aloud', 'format'),

  -- Content notes
  ('Violence', 'content'), ('Strong language', 'content'), ('Sexual content', 'content'),
  ('Death', 'content'), ('Abuse', 'content'), ('Mental health', 'content'), ('Addiction', 'content'),
  ('Animal harm', 'content')
) as t(name, category)
on conflict (slug) do nothing;
