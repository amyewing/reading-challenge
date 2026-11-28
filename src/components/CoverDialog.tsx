import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { coverUrlFor, findCovers } from '../lib/openLibrary';
import type { Book } from '../lib/types';

interface Props {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover_url' | 'open_library_key'>;
  /** You added this cover, or you are a site admin: you may remove it */
  canRemove: boolean;
  onClose: () => void;
  /** The cover was added, changed or removed, so the page should reload */
  onChanged: () => void;
}

/** Add a cover for a book that has none, by choosing one of the covers Open Library has for it. */
export default function CoverDialog({ book, canRemove, onClose, onChanged }: Props) {
  const [ids, setIds] = useState<number[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasCover = !!book.cover_url;

  useEffect(() => {
    const ctrl = new AbortController();
    findCovers(book, ctrl.signal)
      .then((r) => {
        setIds(r.ids);
        setFailed(r.failed);
      })
      .catch((e) => e.name !== 'AbortError' && setFailed(true));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
      onClose();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  const choose = (id: number) =>
    run(() => api(`/api/books/${book.id}/cover`, { method: 'PUT', body: { coverUrl: coverUrlFor(id) } }));

  const remove = () => {
    if (!confirm('Take this cover off the book? It will show as missing a cover again, for everyone.')) return;
    return run(() => api(`/api/books/${book.id}/cover`, { method: 'DELETE' }));
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">{hasCover ? 'Change the cover of' : 'Add a cover to'}</p>
        <h2>{book.title}</h2>
        {book.author && <p className="muted">{book.author}</p>}
        <p className="small muted">
          Choose the cover that matches your copy. It shows for everyone, in every group. After that, only you (or a site
          admin) can change or remove it.
        </p>

        {ids === null && !failed && <p className="small muted">Looking for covers on Open Library…</p>}
        {failed && <p className="error small">Open Library isn't responding right now. Please try again in a bit.</p>}
        {ids && ids.length === 0 && !failed && <p className="small muted">Open Library doesn't have a cover for this book yet.</p>}
        {ids && ids.length > 0 && (
          <div className="cover-grid">
            {ids.map((id) => (
              <button
                key={id}
                type="button"
                className="cover-choice"
                disabled={busy}
                onClick={() => choose(id)}
                aria-label="Use this cover"
              >
                <img src={coverUrlFor(id)} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {error && <p className="error">{error}</p>}
        <div className="row dialog-actions">
          {hasCover && canRemove && (
            <button type="button" className="link danger" disabled={busy} onClick={remove}>Remove cover</button>
          )}
          <span className="grow" />
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
