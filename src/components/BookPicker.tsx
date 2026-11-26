import { useEffect, useState } from 'react';
import { searchBooks, type BookSearchResult } from '../lib/openLibrary';
import type { Book } from '../lib/types';
import BookCover from './BookCover';

/** The book chosen in a dialog: one already in our catalog, an Open Library result, or typed in. */
export type PickedBook =
  | { kind: 'existing'; book: Book }
  | { kind: 'search'; result: BookSearchResult }
  | { kind: 'manual'; title: string; author: string };

export const pickedFromBook = (book: Book | null | undefined): PickedBook | null =>
  book ? { kind: 'existing', book } : null;

export function isComplete(picked: PickedBook | null) {
  return !!picked && (picked.kind !== 'manual' || picked.title.trim().length > 0);
}

/** What the API expects for `book` */
export function bookPayload(picked: PickedBook) {
  if (picked.kind === 'existing') return { id: picked.book.id };
  if (picked.kind === 'search') {
    const r = picked.result;
    return { title: r.title, author: r.author, coverUrl: r.coverUrl, openLibraryKey: r.key, year: r.year };
  }
  return { title: picked.title, author: picked.author.trim() || null };
}

interface Props {
  value: PickedBook | null;
  onChange: (value: PickedBook | null) => void;
  label?: string;
}

/** Search Open Library (or type a book in), then show the chosen book. */
export default function BookPicker({ value, onChange, label = 'Find your book' }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Search as the user types (debounced)
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        setResults(await searchBooks(query.trim(), ctrl.signal));
      } catch (e: any) {
        if (e.name !== 'AbortError') setSearchError(e.message);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  if (!value) {
    return (
      <>
        <label>
          {label}
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title, author, or both" />
        </label>
        {searching && <p className="small muted">Searching…</p>}
        {searchError && <p className="error small">{searchError}</p>}
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.key}>
              <button type="button" onClick={() => onChange({ kind: 'search', result: r })}>
                <BookCover book={{ title: r.title, cover_url: r.coverUrl }} small />
                <span>
                  <strong>{r.title}</strong>
                  <span className="small muted">{[r.author, r.year].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="link small" onClick={() => onChange({ kind: 'manual', title: query, author: '' })}>
          Can't find it? Enter it yourself
        </button>
      </>
    );
  }

  return (
    <>
      {value.kind === 'manual' ? (
        <div className="row">
          <label className="grow">
            Title
            <input autoFocus value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} required />
          </label>
          <label className="grow">
            Author
            <input value={value.author} onChange={(e) => onChange({ ...value, author: e.target.value })} />
          </label>
        </div>
      ) : (
        <div className="picked">
          <BookCover
            book={value.kind === 'search' ? { title: value.result.title, cover_url: value.result.coverUrl } : value.book}
            small
          />
          <div className="grow">
            <strong>{value.kind === 'search' ? value.result.title : value.book.title}</strong>
            <div className="small muted">{value.kind === 'search' ? value.result.author : value.book.author}</div>
          </div>
        </div>
      )}
      <button type="button" className="link small" onClick={() => onChange(null)}>Choose a different book</button>
    </>
  );
}
