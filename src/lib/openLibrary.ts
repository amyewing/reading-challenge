// Free book search — https://openlibrary.org/dev/docs/api/search

export interface BookSearchResult {
  key: string; // e.g. "/works/OL45804W"
  title: string;
  author: string | null;
  year: number | null;
  coverUrl: string | null;
}

/** Search everything, or only titles, or only author names */
export type SearchMode = 'any' | 'title' | 'author';

export async function searchBooks(query: string, mode: SearchMode = 'any', signal?: AbortSignal): Promise<BookSearchResult[]> {
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set(mode === 'any' ? 'q' : mode, query);
  // An author search lists their books, so show more of them
  url.searchParams.set('limit', mode === 'author' ? '25' : '10');
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i');
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Book search is unavailable right now');
  const json = await res.json();
  return (json.docs ?? []).map((d: any) => ({
    key: d.key,
    title: d.title,
    author: d.author_name?.slice(0, 2).join(', ') ?? null,
    year: d.first_publish_year ?? null,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
  }));
}

/**
 * Cover images Open Library has for a book, as ids for https://covers.openlibrary.org/b/id/<id>-M.jpg.
 * Covers of the work's own editions come first, then the best match for the title and author.
 * `failed` is true only when Open Library couldn't be reached at all.
 */
export async function findCovers(
  book: { title: string; author: string | null; open_library_key?: string | null },
  signal?: AbortSignal,
): Promise<{ ids: number[]; failed: boolean }> {
  const fromEditions = async () => {
    const key = book.open_library_key;
    if (!key || !new RegExp('^/works/OL[0-9]+W$').test(key)) return [];
    const res = await fetch(`https://openlibrary.org${key}/editions.json?limit=50`, { signal });
    if (!res.ok) throw new Error('editions');
    const json = await res.json();
    return (json.entries ?? []).flatMap((e: any) => e.covers ?? []);
  };
  const fromSearch = async () => {
    const url = new URL('https://openlibrary.org/search.json');
    url.searchParams.set('title', book.title);
    if (book.author) url.searchParams.set('author', book.author);
    url.searchParams.set('limit', '5');
    url.searchParams.set('fields', 'cover_i');
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error('search');
    const json = await res.json();
    return (json.docs ?? []).map((d: any) => d.cover_i);
  };
  const results = await Promise.allSettled([fromEditions(), fromSearch()]);
  const ids: number[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const id of r.value) if (typeof id === 'number' && id > 0 && !ids.includes(id)) ids.push(id);
  }
  return { ids: ids.slice(0, 12), failed: results.every((r) => r.status === 'rejected') };
}

export const coverUrlFor = (id: number) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`;
