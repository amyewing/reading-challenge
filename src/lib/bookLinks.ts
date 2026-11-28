import type { Book } from './types';

export interface BookLink {
  label: string;
  url: string;
}

/**
 * Places to find a book, worked out from its title and author (nothing is stored, so there is
 * nothing to go stale). Each is a search for the book, except Open Library's own page when we
 * know which work it is.
 */
export function bookLinks(book: Pick<Book, 'title' | 'author' | 'open_library_key'>): BookLink[] {
  const words = [book.title, book.author].filter(Boolean).join(' ');
  const q = encodeURIComponent(words);
  const key = book.open_library_key;
  return [
    { label: 'Amazon', url: `https://www.amazon.com/s?k=${q}&i=stripbooks` },
    { label: 'Bookshop.org', url: `https://bookshop.org/search?keywords=${q}` },
    { label: 'Goodreads', url: `https://www.goodreads.com/search?q=${q}` },
    {
      label: 'Open Library',
      // Keys look like "/works/OL45804W"; anything else falls back to a search
      url: key && /^\/works\/OL\d+W$/.test(key) ? `https://openlibrary.org${key}` : `https://openlibrary.org/search?q=${q}`,
    },
  ];
}
