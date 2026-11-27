import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Consideration, Prompt } from '../lib/types';
import BookCover from './BookCover';

interface Props {
  prompt: Prompt;
  /** The book on your list that you are reading (or starting to read) */
  consideration: Consideration;
  onClose: () => void;
  onSaved: () => void;
}

const QUICK = [
  { label: 'Just started', value: 5 },
  { label: '25%', value: 25 },
  { label: 'Halfway', value: 50 },
  { label: '75%', value: 75 },
  { label: 'Nearly done', value: 95 },
];

/** Say roughly how far through a book you are. The percentage is approximate on purpose. */
export default function ReadingProgressDialog({ prompt, consideration, onClose, onSaved }: Props) {
  const reading = consideration.status === 'reading';
  const [progress, setProgress] = useState(consideration.progress ?? 0);
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
      await api(`/api/considerations/${consideration.id}/reading`, { method: 'PUT', body: { progress } });
      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function stop() {
    try {
      await api(`/api/considerations/${consideration.id}/reading`, { method: 'DELETE' });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <p className="eyebrow">{reading ? 'How far are you through' : 'Start reading'}</p>
        <h2>{consideration.books?.title}</h2>
        <p className="small muted">For “{prompt.title}”</p>

        <div className="picked">
          <BookCover book={consideration.books} small />
          <div className="grow">
            <div className="progress-readout">{progress}%</div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              aria-label="Roughly how far through the book you are"
            />
          </div>
        </div>
        <div className="tag-row">
          {QUICK.map((q) => (
            <button
              type="button"
              key={q.label}
              className={`tag-chip ${progress === q.value ? 'on' : ''}`}
              onClick={() => setProgress(q.value)}
            >
              {q.label}
            </button>
          ))}
        </div>
        <p className="small muted">A rough guess is fine. Your group can see it.</p>

        {error && <p className="error">{error}</p>}
        <div className="row dialog-actions">
          {reading && <button type="button" className="link danger" onClick={stop}>Stop reading</button>}
          <span className="grow" />
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={saving}>{saving ? 'Saving…' : reading ? 'Save' : 'Start reading'}</button>
        </div>
      </form>
    </div>
  );
}
