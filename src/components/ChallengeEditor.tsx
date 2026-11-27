import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';

export interface EditorPrompt {
  key: string; // stable React key, also for prompts not saved yet
  id: string | null; // null for prompts not saved yet
  title: string;
  description: string;
}

export interface ChallengeValues {
  title: string;
  description: string;
  startsOn: string;
  endsOn: string;
  prompts: EditorPrompt[];
}

interface Props {
  initial: ChallengeValues;
  /** 'draft' shows "Save and launch"; 'active' means it's already launched */
  status: 'draft' | 'active';
  /** Books logged per saved prompt id; those prompts can't be removed */
  entryCounts?: Record<string, number>;
  cancelTo: string;
  submitLabel: string;
  onSave: (values: ChallengeValues, launch: boolean) => Promise<void>;
}

let nextKey = 0;
export const newPrompt = (title = '', id: string | null = null, description = ''): EditorPrompt => ({
  key: `p${nextKey++}`,
  id,
  title,
  description,
});

export default function ChallengeEditor({ initial, status, entryCounts = {}, cancelTo, submitLabel, onSave }: Props) {
  const [values, setValues] = useState<ChallengeValues>(initial);
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initial.prompts.filter((p) => p.description).map((p) => [p.key, true])),
  );
  // The prompt whose note box was just opened with "+ About this prompt", so the cursor goes straight in
  // (boxes that are already open when the page loads don't take focus)
  const [justOpened, setJustOpened] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [saving, setSaving] = useState<null | 'save' | 'launch'>(null);
  const [error, setError] = useState<string | null>(null);

  const prompts = values.prompts;
  const filledCount = prompts.filter((p) => p.title.trim()).length;
  const set = (patch: Partial<ChallengeValues>) => setValues((v) => ({ ...v, ...patch }));
  const setPrompts = (fn: (ps: EditorPrompt[]) => EditorPrompt[]) => setValues((v) => ({ ...v, prompts: fn(v.prompts) }));

  function updatePrompt(key: string, patch: Partial<EditorPrompt>) {
    setPrompts((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }
  function move(i: number, dir: -1 | 1) {
    setPrompts((ps) => {
      const j = i + dir;
      if (j < 0 || j >= ps.length) return ps;
      const next = [...ps];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function addBulk() {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    // Replace trailing empty rows rather than leaving gaps
    setPrompts((ps) => [...ps.filter((p) => p.title.trim() || p.id), ...lines.map((l) => newPrompt(l))]);
    setBulkText('');
    setShowBulk(false);
  }

  async function submit(e: FormEvent, launch = false) {
    e.preventDefault();
    if (launch && !confirm('Launch this challenge? Everyone in the group will see it and can start logging books.')) return;
    setSaving(launch ? 'launch' : 'save');
    setError(null);
    try {
      await onSave(values, launch);
    } catch (err: any) {
      setError(err.message);
      setSaving(null);
    }
  }

  return (
    <form className="form card" onSubmit={(e) => submit(e)}>
      <label>
        Title
        <input value={values.title} onChange={(e) => set({ title: e.target.value })} required maxLength={150} />
      </label>
      <label>
        Description <span className="muted">(optional)</span>
        <textarea
          value={values.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={2}
          placeholder="Any rules? e.g. one book per prompt, audiobooks count"
        />
      </label>
      <div className="row">
        <label className="grow">
          Starts
          <input type="date" value={values.startsOn} onChange={(e) => set({ startsOn: e.target.value })} />
        </label>
        <label className="grow">
          Ends
          <input type="date" value={values.endsOn} onChange={(e) => set({ endsOn: e.target.value })} />
        </label>
      </div>

      <div className="section-head">
        <h2>
          Prompts <span className="muted small">({filledCount})</span>
        </h2>
        <button type="button" className="link" onClick={() => setShowBulk(!showBulk)}>
          {showBulk ? 'Cancel' : 'Add several at once'}
        </button>
      </div>

      {showBulk && (
        <div className="bulk-add">
          <label>
            One prompt per line
            <textarea
              rows={8}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'A book set in a country you have never visited\nA memoir by someone outside your generation\nA book with a color in the title'}
              autoFocus
            />
          </label>
          <button type="button" onClick={addBulk} disabled={!bulkText.trim()}>
            Add to the list
          </button>
        </div>
      )}

      {prompts.length === 0 && <p className="muted small">No prompts yet. You can save now and add them later.</p>}
      <ol className="prompt-editor">
        {prompts.map((p, i) => {
          const logged = p.id ? entryCounts[p.id] ?? 0 : 0;
          return (
            <li key={p.key}>
              <div className="prompt-row">
                <input
                  value={p.title}
                  onChange={(e) => updatePrompt(p.key, { title: e.target.value })}
                  placeholder="e.g. A book translated from another language"
                  maxLength={300}
                />
                <button type="button" className="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                <button type="button" className="icon" onClick={() => move(i, 1)} disabled={i === prompts.length - 1} aria-label="Move down">↓</button>
                <button
                  type="button"
                  className="icon"
                  onClick={() => setPrompts((ps) => ps.filter((x) => x.key !== p.key))}
                  disabled={logged > 0}
                  title={logged > 0 ? `Can't remove: ${logged} logged ${logged === 1 ? 'book' : 'books'}` : 'Remove'}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
              <div className="prompt-extra">
                {logged > 0 && <span className="small muted">{logged} logged {logged === 1 ? 'book' : 'books'} · </span>}
                {openDetails[p.key] ? (
                  <textarea
                    className="prompt-details"
                    rows={3}
                    value={p.description}
                    onChange={(e) => updatePrompt(p.key, { description: e.target.value })}
                    placeholder="About this prompt: what it means, why it was chosen, examples. Links become clickable."
                    maxLength={5000}
                    autoFocus={justOpened === p.key}
                  />
                ) : (
                  <button
                    type="button"
                    className="link small"
                    onClick={() => {
                      setOpenDetails({ ...openDetails, [p.key]: true });
                      setJustOpened(p.key);
                    }}
                  >
                    + About this prompt
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div>
        <button type="button" onClick={() => setPrompts((ps) => [...ps, newPrompt()])}>
          + Add prompt
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="primary" disabled={!!saving || !values.title.trim()}>
          {saving === 'save' ? 'Saving…' : submitLabel}
        </button>
        {status === 'draft' && (
          <button
            type="button"
            disabled={!!saving || !values.title.trim() || filledCount === 0}
            onClick={(e) => submit(e, true)}
            title={filledCount === 0 ? 'Add at least one prompt first' : undefined}
          >
            {saving === 'launch' ? 'Launching…' : 'Save and launch'}
          </button>
        )}
        <Link to={cancelTo}>Cancel</Link>
      </div>
      {status === 'draft' && (
        <p className="small muted">
          Drafts are only visible to you and the group's admins. Launch it when it's ready for everyone.
        </p>
      )}
    </form>
  );
}

/** Shape the editor's values for the API */
export function toPayload(v: ChallengeValues) {
  return {
    title: v.title,
    description: v.description,
    startsOn: v.startsOn || null,
    endsOn: v.endsOn || null,
    prompts: v.prompts
      .filter((p) => p.title.trim())
      .map((p) => ({ id: p.id, title: p.title, description: p.description || null })),
  };
}
