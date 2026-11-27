import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Book, Consideration, Prompt } from '../lib/types';
import BookPicker, { bookPayload, isComplete, pickedFromBook, type PickedBook } from './BookPicker';
import DialogTags, { saveDialogTags } from './DialogTags';
import { useMyBookTags } from '../lib/useMyBookTags';

interface Props {
  prompt: Prompt;
  /** Editing a book already on your list */
  existing: Consideration | null;
  /** Start with this book chosen (e.g. adding someone else's idea to your list) */
  initialBook?: Book | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Add a book you might read for a prompt to your "considering" list, with why. */
export default function ConsiderDialog({ prompt, existing, initialBook, onClose, onSaved }: Props) {
  const [picked, setPicked] = useState<PickedBook | null>(pickedFromBook(existing?.books ?? initialBook));
  const [reason, setReason] = useState(existing?.reason ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const myTags = useMyBookTags(picked?.kind === 'existing' ? picked.book.id : null);

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
      const body = { book: bookPayload(picked), reason: reason.trim() || null };
      const saved = existing
        ? await api<{ bookId: string }>(`/api/considerations/${existing.id}`, { method: 'PUT', body })
        : await api<{ bookId: string }>(`/api/prompts/${prompt.id}/considerations`, { method: 'POST', body });
      await saveDialogTags(myTags, saved?.bookId);
      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing) return;
    try {
      await api(`/api/considerations/${existing.id}`, { method: 'DELETE' });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <p className="eyebrow">{existing ? 'A book you’re considering for' : 'Consider a book for'}</p>
        <h2>{prompt.title}</h2>
        {prompt.description && <p className="small muted">{prompt.description}</p>}

        <BookPicker value={picked} onChange={setPicked} label="Which book?" />

        {picked && (
          <label>
            Why it might fit <span className="muted">(optional, visible to your group)</span>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Set in Iceland, and Grandma loved it"
            />
          </label>
        )}
        {picked && <DialogTags myTags={myTags} />}

        {error && <p className="error">{error}</p>}
        <div className="row dialog-actions">
          {existing && <button type="button" className="link danger" onClick={remove}>Take off my list</button>}
          <span className="grow" />
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!isComplete(picked) || saving}>
            {saving ? 'Saving…' : existing ? 'Save' : 'Add to my list'}
          </button>
        </div>
      </form>
    </div>
  );
}
