export type Role = 'owner' | 'admin' | 'member';

export interface Profile {
  id: string;
  display_name: string;
  email: string | null;
}

export interface Member {
  user_id: string;
  role: Role;
  joined_at: string;
  /** avatar: a small copy of their photo (or the full one); avatar_preset: their chosen built-in icon */
  profiles: (Pick<Profile, 'display_name' | 'email'> & { avatar?: string | null; avatar_preset?: string | null }) | null;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
}

export interface Challenge {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  created_by: string;
  status: 'draft' | 'active';
  launched_at: string | null;
  /** Present on the challenge page: whether you may edit/launch/delete it */
  can_manage?: boolean;
}

export interface Prompt {
  id: string;
  position: number;
  title: string;
  description: string | null;
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  /** Open Library work, e.g. "/works/OL45804W" (books picked from Open Library have one) */
  open_library_key?: string | null;
  /** Who added the cover; null when it came with the book from Open Library */
  cover_added_by?: string | null;
}

export interface Entry {
  id: string;
  prompt_id: string;
  user_id: string;
  finished_on: string | null;
  rating: number | null;
  notes: string | null;
  books: Book | null;
  profiles: Pick<Profile, 'display_name'> | null;
}

/** A book someone might read for a prompt, and why */
export interface Consideration {
  id: string;
  prompt_id: string;
  user_id: string;
  reason: string | null;
  created_at: string;
  /** "reading" once you have started it */
  status: 'considering' | 'reading';
  /** Approximate percentage read (0-100) while reading */
  progress: number | null;
  started_on: string | null;
  books: Book | null;
  profiles: Pick<Profile, 'display_name'> | null;
}

export type TagCategory = 'genre' | 'mood' | 'pace' | 'story' | 'theme' | 'format' | 'content' | 'custom';

/** A tag in the library */
export interface Tag {
  id: string;
  name: string;
  category: TagCategory;
  suggested: boolean;
  /** Order within the suggested library (null for tags people added) */
  position: number | null;
  book_count: number;
}

/** A tag on one book: how many people chose it, and whether you did */
export interface BookTag {
  id: string;
  name: string;
  category: TagCategory;
  count: number;
  mine: boolean;
}

export interface Me {
  id: string;
  name: string;
  /** A site admin can change or remove any book's cover (not the same as a group admin) */
  isSiteAdmin?: boolean;
}

/** A message in a discussion thread (the prompt's general thread, or one book's thread on it) */
export interface PromptMessage {
  id: string;
  prompt_id: string;
  user_id: string;
  body: string;
  spoiler: boolean;
  created_at: string;
  edited_at: string | null;
  profiles: Pick<Profile, 'display_name'> | null;
}

/** How many messages a thread has (book_id null: the prompt's general thread), and how many are new to you */
export interface MessageCount {
  prompt_id: string;
  book_id: string | null;
  count: number;
  unread: number;
  books: Book | null;
}
