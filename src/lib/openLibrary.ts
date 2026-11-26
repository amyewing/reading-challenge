// Free book search — https://openlibrary.org/dev/docs/api/search

export interface BookSearchResult {
  key: string; // e.g. "/works/OL45804W"
  title: string;
  author: string | null;
  year: number | null;
  coverUrl: string | null;
}

export async function searchBooks(query: string, signal?: AbortSignal): Promise<BookSearchResult[]> {
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '10');
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
