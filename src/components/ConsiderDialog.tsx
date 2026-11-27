import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Book, Consideration, Prompt } from '../lib/types';
import BookPicker, { bookPayload, isComplete, pickedFromBook, type PickedBook } from './BookPicker';
import DialogTags, { saveDialogTags } from './DialogTags';
import RichText from './RichText';
import { useMyBookTags } from '../lib/useMyBookTags';

interface Props {
  prompt: Prompt;
  /** Editing a book already on your list */
  existing: Consideration | null;
  /** Start with this book chosen (e.g. adding someone else's idea to your list) */
  initialBook?: Book | null;
  /** Start reading the book now (it goes on your list as "reading", with a rough progress) */
  reading?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** Add a book you might read for a prompt to your "considering" list, with why. */
export default function ConsiderDialog({ prompt, existing, initialBook, reading = false, onClose, onSaved }: Props) {
  const [picked, setPicked] = useState<PickedBook | null>(pickedFromBook(existing?.books ?? initialBook));
  const [reason, setReason] = useState(existing?.reason ?? '');
  const [progress, setProgress] = useState(0);
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
      const body = {
        book: bookPayload(picked),
        reason: reason.trim() || null,
        ...(reading && !existing ? { reading: true, progress } : {}),
      };
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
        <p className="eyebrow">
          {existing ? 'A book you’re considering for' : reading ? 'Start reading a book for' : 'Consider a book for'}
        </p>
        <h2>{prompt.title}</h2>
        {prompt.description && <RichText text={prompt.description} clamp className="small muted" />}

        <BookPicker value={picked} onChange={setPicked} label="Which book?" />

        {picked && reading && !existing && (
          <label>
            How far in are you? <span className="muted">(roughly {progress}%, visible to your group)</span>
            <input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
          </label>
        )}

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
            {saving ? 'Saving…' : existing ? 'Save' : reading ? 'Start reading' : 'Add to my list'}
          </button>
        </div>
      </form>
    </div>
  );
}
