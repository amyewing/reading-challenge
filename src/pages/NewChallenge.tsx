import { FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

const year = new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear();

export default function NewChallenge() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState(`${year} Reading Challenge`);
  const [description, setDescription] = useState('');
  const [startsOn, setStartsOn] = useState(`${year}-01-01`);
  const [endsOn, setEndsOn] = useState(`${year}-12-31`);
  const [prompts, setPrompts] = useState<string[]>(['', '', '']);
  const [bulk, setBulk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = prompts.map((p) => p.trim()).filter(Boolean);

  function updatePrompt(i: number, value: string) {
    setPrompts((ps) => ps.map((p, j) => (j === i ? value : p)));
  }
  function move(i: number, dir: -1 | 1) {
    setPrompts((ps) => {
      const next = [...ps];
      const j = i + dir;
      if (j < 0 || j >= next.length) return ps;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>(`/api/groups/${groupId}/challenges`, {
        method: 'POST',
        body: { title, description, startsOn: startsOn || null, endsOn: endsOn || null, prompts: filled },
      });
      navigate(`/challenges/${id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <>
      <p className="crumbs"><Link to={`/groups/${groupId}`}>Back to group</Link></p>
      <h1>New challenge</h1>
      <form className="form card" onSubmit={save}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={150} />
        </label>
        <label>
          Description <span className="muted">(optional)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Any rules? e.g. one book per prompt, audiobooks count" />
        </label>
        <div className="row">
          <label className="grow">
            Starts
            <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </label>
          <label className="grow">
            Ends
            <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </label>
        </div>

        <div className="section-head">
          <h2>Prompts <span className="muted small">({filled.length})</span></h2>
          <button type="button" className="link" onClick={() => setBulk(!bulk)}>
            {bulk ? 'Edit one by one' : 'Paste a list'}
          </button>
        </div>

        {bulk ? (
          <label>
            One prompt per line
            <textarea
              rows={12}
              value={prompts.join('\n')}
              onChange={(e) => setPrompts(e.target.value.split('\n'))}
              placeholder={'A book set in a country you have never visited\nA memoir by someone outside your generation\nA book with a color in the title'}
            />
          </label>
        ) : (
          <ol className="prompt-editor">
            {prompts.map((p, i) => (
              <li key={i}>
                <input value={p} onChange={(e) => updatePrompt(i, e.target.value)} placeholder="e.g. A book translated from another language" />
                <button type="button" className="icon" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                <button type="button" className="icon" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                <button type="button" className="icon" onClick={() => setPrompts(prompts.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => setPrompts([...prompts, ''])}>+ Add prompt</button>
            </li>
          </ol>
        )}

        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={saving || !title.trim() || filled.length === 0}>
          {saving ? 'Creating…' : 'Create challenge'}
        </button>
      </form>
    </>
  );
}
