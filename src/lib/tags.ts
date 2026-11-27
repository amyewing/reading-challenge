import { useEffect, useState } from 'react';
import { api } from './api';
import type { Tag, TagCategory } from './types';

export const CATEGORIES: { key: TagCategory; label: string }[] = [
  { key: 'genre', label: 'Genre' },
  { key: 'mood', label: 'Mood' },
  { key: 'pace', label: 'Pace' },
  { key: 'story', label: 'Story' },
  { key: 'theme', label: 'Themes' },
  { key: 'format', label: 'Format' },
  { key: 'content', label: 'Content notes' },
  { key: 'custom', label: 'Added by readers' },
];

// The tag library is loaded once and shared by every picker on the page
let cache: Promise<Tag[]> | null = null;
const listeners = new Set<(tags: Tag[]) => void>();

export function loadTags(): Promise<Tag[]> {
  cache ??= api<Tag[]>('/api/tags').catch((e) => {
    cache = null;
    throw e;
  });
  return cache;
}

/** Reload counts after tagging (used by the Find books page) */
export function refreshTags() {
  cache = null;
  return loadTags().then((tags) => {
    listeners.forEach((fn) => fn(tags));
    return tags;
  });
}

/** Add your own tag (or get the existing one with that name) */
export async function createTag(name: string): Promise<Tag> {
  const tag = await api<Tag>('/api/tags', { method: 'POST', body: { name } });
  const tags = await loadTags();
  if (!tags.some((t) => t.id === tag.id)) {
    const next = [...tags, tag];
    cache = Promise.resolve(next);
    listeners.forEach((fn) => fn(next));
  }
  return tag;
}

export function useTags() {
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadTags().then((t) => live && setTags(t), (e) => live && setError(e.message));
    const onChange = (t: Tag[]) => live && setTags(t);
    listeners.add(onChange);
    return () => {
      live = false;
      listeners.delete(onChange);
    };
  }, []);
  return { tags, error };
}

/** Most-used first, then the library's own order, then A–Z */
export function sortTags(tags: Tag[]) {
  return [...tags].sort(
    (a, b) =>
      b.book_count - a.book_count ||
      (a.position ?? 1e9) - (b.position ?? 1e9) ||
      a.name.localeCompare(b.name),
  );
}
