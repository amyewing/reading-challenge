import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { searchBooks, type BookSearchResult } from '../lib/openLibrary';
import type { Entry, Prompt } from '../lib/types';
import BookCover from './BookCover';

interface Props {
  challengeId: string;
  prompt: Prompt;
  existing: Entry | null;
  onClose: () => void;
  onSaved: () => void;
}

type Picked =
  | { kind: 'existing'; bookId: string; title: string; author: string | null; coverUrl: string | null }
  | { kind: 'search'; result: BookSearchResult }
  | { kind: 'manual' };

const today = () => new Date().toISOString().slice(0, 10);

export default function LogBookDialog({ challengeId, prompt, existing, onClose, onSaved }: Props) {
  const [picked, setPicked] = useState<Picked | null>(
    existing?.books
      ? { kind: 'existing', bookId: existing.books.id, title: existing.books.title, author: existing.books.author, coverUrl: existing.books.cover_url }
      : null,
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');
  const [finishedOn, setFinishedOn] = useState(existing?.finished_on ?? today());
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search Open Library as the user types (debounced)
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

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function bookPayload() {
    if (!picked) throw new Error('Choose a book first');
    if (picked.kind === 'existing') return { id: picked.bookId };
    if (picked.kind === 'search') {
      const r = picked.result;
      return { title: r.title, author: r.author, coverUrl: r.coverUrl, openLibraryKey: r.key, year: r.year };
    }
    if (!manualTitle.trim()) throw new Error('Enter the book title');
    return { title: manualTitle, author: manualAuthor || null };
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/api/prompts/${prompt.id}/my-entry`, {
        method: 'PUT',
        body: { book: bookPayload(), finishedOn: finishedOn || null, rating, notes: notes.trim() || null },
      });
      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing || !confirm('Remove this book from the prompt?')) return;
    try {
      await api(`/api/prompts/${prompt.id}/my-entry`, { method: 'DELETE' });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <p className="eyebrow">Log a book for</p>
        <h2>{prompt.title}</h2>

        {!picked && (
          <>
            <label>
              Find your book
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title, author, or both" />
            </label>
            {searching && <p className="small muted">Searching…</p>}
            {searchError && <p className="error small">{searchError}</p>}
            <ul className="search-results">
              {results.map((r) => (
                <li key={r.key}>
                  <button type="button" onClick={() => setPicked({ kind: 'search', result: r })}>
                    <BookCover book={{ title: r.title, cover_url: r.coverUrl }} small />
                    <span>
                      <strong>{r.title}</strong>
                      <span className="small muted">{[r.author, r.year].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="link small" onClick={() => setPicked({ kind: 'manual' })}>
              Can't find it? Enter it yourself
            </button>
          </>
        )}

        {picked?.kind === 'manual' && (
          <div className="row">
            <label className="grow">
              Title
              <input autoFocus value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} required />
            </label>
            <label className="grow">
              Author
              <input value={manualAuthor} onChange={(e) => setManualAuthor(e.target.value)} />
            </label>
          </div>
        )}

        {picked && picked.kind !== 'manual' && (
          <div className="picked">
            <BookCover book={{ title: picked.kind === 'search' ? picked.result.title : picked.title, cover_url: picked.kind === 'search' ? picked.result.coverUrl : picked.coverUrl }} small />
            <div className="grow">
              <strong>{picked.kind === 'search' ? picked.result.title : picked.title}</strong>
              <div className="small muted">{picked.kind === 'search' ? picked.result.author : picked.author}</div>
            </div>
          </div>
        )}
        {picked && (
          <button type="button" className="link small" onClick={() => setPicked(null)}>Choose a different book</button>
        )}

        {picked && (
          <>
            <div className="row">
              <label>
                Finished on
                <input type="date" value={finishedOn} onChange={(e) => setFinishedOn(e.target.value)} />
              </label>
              <div className="rating">
                <span>Rating</span>
                <div>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      className={`star ${rating && n <= rating ? 'on' : ''}`}
                      onClick={() => setRating(rating === n ? null : n)}
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label>
              Notes <span className="muted">(optional, visible to your group)</span>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you think?" />
            </label>
          </>
        )}

        {error && <p className="error">{error}</p>}
        <div className="row dialog-actions">
          {existing && <button type="button" className="link danger" onClick={remove}>Remove</button>}
          <span className="grow" />
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!picked || saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
