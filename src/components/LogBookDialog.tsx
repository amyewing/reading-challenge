import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Book, Entry, Prompt } from '../lib/types';
import BookPicker, { bookPayload, isComplete, pickedFromBook, type PickedBook } from './BookPicker';
import DialogTags, { saveDialogTags } from './DialogTags';
import { useMyBookTags } from '../lib/useMyBookTags';

interface Props {
  prompt: Prompt;
  existing: Entry | null;
  /** Start with this book chosen (e.g. logging a book from your "considering" list) */
  initialBook?: Book | null;
  onClose: () => void;
  onSaved: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function LogBookDialog({ prompt, existing, initialBook, onClose, onSaved }: Props) {
  const [picked, setPicked] = useState<PickedBook | null>(pickedFromBook(initialBook ?? existing?.books));
  const [finishedOn, setFinishedOn] = useState(existing?.finished_on ?? today());
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const myTags = useMyBookTags(picked?.kind === 'existing' ? picked.book.id : null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!picked || !isComplete(picked)) return setError('Choose a book first.');
    setSaving(true);
    setError(null);
    try {
      const body = { book: bookPayload(picked), finishedOn: finishedOn || null, rating, notes: notes.trim() || null };
      const saved = existing
        ? await api<{ bookId: string }>(`/api/entries/${existing.id}`, { method: 'PUT', body })
        : await api<{ bookId: string }>(`/api/prompts/${prompt.id}/entries`, { method: 'POST', body });
      await saveDialogTags(myTags, saved?.bookId);
      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing || !confirm('Remove this book from the prompt?')) return;
    try {
      await api(`/api/entries/${existing.id}`, { method: 'DELETE' });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <p className="eyebrow">{existing ? 'A book you logged for' : 'Log a book for'}</p>
        <h2>{prompt.title}</h2>

        <BookPicker value={picked} onChange={setPicked} />

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
            <DialogTags myTags={myTags} />
          </>
        )}

        {error && <p className="error">{error}</p>}
        <div className="row dialog-actions">
          {existing && <button type="button" className="link danger" onClick={remove}>Remove</button>}
          <span className="grow" />
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!isComplete(picked) || saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
