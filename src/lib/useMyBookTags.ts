import { useEffect, useState } from 'react';
import { api } from './api';
import { refreshTags } from './tags';
import type { BookTag } from './types';

/**
 * Your tags on a book, for editing in a dialog. Loads them when the book is already in the
 * catalog; `save` writes them only if you changed something, so picking a book never wipes
 * tags you set earlier.
 */
export function useMyBookTags(bookId: string | null) {
  const [selected, setSelectedState] = useState<string[]>([]);
  const [others, setOthers] = useState<{ id: string; label: string }[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDirty(false);
    setSelectedState([]);
    setOthers([]);
    if (!bookId) return;
    let live = true;
    setLoading(true);
    api<BookTag[]>(`/api/books/${bookId}/tags`)
      .then((tags) => {
        if (!live) return;
        setSelectedState(tags.filter((t) => t.mine).map((t) => t.id));
        setOthers(
          tags
            .filter((t) => t.count - (t.mine ? 1 : 0) > 0)
            .map((t) => ({ id: t.id, label: `${t.name} · ${t.count - (t.mine ? 1 : 0)}` })),
        );
      })
      .catch(() => undefined)
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [bookId]);

  return {
    selected,
    others,
    loading,
    dirty,
    setSelected(ids: string[]) {
      setSelectedState(ids);
      setDirty(true);
    },
    async save(forBookId: string) {
      if (!dirty) return null;
      const tags = await api<BookTag[]>(`/api/books/${forBookId}/my-tags`, { method: 'PUT', body: { tagIds: selected } });
      refreshTags().catch(() => undefined); // update the library's book counts
      return tags;
    },
  };
}
