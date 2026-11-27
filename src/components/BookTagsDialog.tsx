import { FormEvent, useEffect, useState } from 'react';
import type { Book } from '../lib/types';
import { useMyBookTags } from '../lib/useMyBookTags';
import BookCover from './BookCover';
import TagPicker from './TagPicker';

interface Props {
  book: Book;
  onClose: () => void;
  onSaved: () => void;
}

/** Add or change your own tags on a book. */
export default function BookTagsDialog({ book, onClose, onSaved }: Props) {
  const myTags = useMyBookTags(book.id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await myTags.save(book.id);
      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <p className="eyebrow">Your tags for</p>
        <div className="picked">
          <BookCover book={book} small />
          <div className="grow">
            <strong>{book.title}</strong>
            {book.author && <div className="small muted">{book.author}</div>}
          </div>
        </div>
        <p className="small muted">
          Tags help everyone find books for a prompt. Pick any that fit, or type your own.
        </p>
        {myTags.loading ? (
          <p className="small muted">Loading…</p>
        ) : (
          <TagPicker selected={myTags.selected} onChange={myTags.setSelected} highlight={myTags.others} />
        )}
        {error && <p className="error">{error}</p>}
        <div className="row dialog-actions">
          <span className="grow" />
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={saving || !myTags.dirty}>{saving ? 'Saving…' : 'Save tags'}</button>
        </div>
      </form>
    </div>
  );
}
