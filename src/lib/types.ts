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
  profiles: Pick<Profile, 'display_name' | 'email'> | null;
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

export interface Me {
  id: string;
  name: string;
}
