import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useMe } from '../App';
import type { Challenge, Entry, Member, Prompt } from '../lib/types';
import LogBookDialog from '../components/LogBookDialog';
import BookCover from '../components/BookCover';

export default function ChallengePage() {
  const { challengeId } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const [logging, setLogging] = useState<{ prompt: Prompt; entry: Entry | null } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const data = useAsync(
    () =>
      api<{ challenge: Challenge & { group_name: string }; prompts: Prompt[]; entries: Entry[]; members: Member[] }>(
        `/api/challenges/${challengeId}`,
      ),
    [challengeId],
  );

  if (data.loading && !data.data) return <p className="muted">Loading…</p>;
  if (data.error || !data.data)
    return (
      <p>
        <span className="error">{data.error}</span> <Link to="/">Go home</Link>
      </p>
    );

  const { challenge, prompts, entries, members } = data.data;
  const canManage = !!challenge.can_manage;
  const isDraft = challenge.status === 'draft';
  const myEntries = new Map(entries.filter((e) => e.user_id === me.id).map((e) => [e.prompt_id, e]));
  const total = prompts.length;

  const progress = members
    .map((m) => ({
      id: m.user_id,
      name: m.profiles?.display_name ?? 'Reader',
      count: entries.filter((e) => e.user_id === m.user_id).length,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  async function launch() {
    if (!confirm('Launch this challenge? Everyone in the group will see it and can start logging books.')) return;
    try {
      await api(`/api/challenges/${challenge.id}/launch`, { method: 'POST' });
      data.reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function deleteChallenge() {
    if (!confirm(`Delete "${challenge.title}" and everyone's logged books for it? This can't be undone.`)) return;
    try {
      await api(`/api/challenges/${challenge.id}`, { method: 'DELETE' });
      navigate(`/groups/${challenge.group_id}`);
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <>
      <p className="crumbs">
        <Link to="/">Groups</Link> / <Link to={`/groups/${challenge.group_id}`}>{challenge.group_name}</Link> /
      </p>
      <div className="section-head title-head">
        <h1>
          {challenge.title} {isDraft && <span className="badge">Draft</span>}
        </h1>
        {canManage && !isDraft && (
          <Link className="button" to={`/challenges/${challenge.id}/edit`}>Edit</Link>
        )}
      </div>
      {challenge.description && <p className="muted">{challenge.description}</p>}

      {isDraft && (
        <section className="card draft-banner">
          <p>
            <strong>This is a draft.</strong> Only you and the group's admins can see it, and books can't be logged
            yet. Keep editing until it's ready, then launch it for the group.
          </p>
          <div className="row">
            <Link className="button" to={`/challenges/${challenge.id}/edit`}>Edit challenge</Link>
            <button
              className="primary"
              onClick={launch}
              disabled={prompts.length === 0}
              title={prompts.length === 0 ? 'Add at least one prompt first' : undefined}
            >
              Launch challenge
            </button>
          </div>
          {prompts.length === 0 && <p className="small muted">Add at least one prompt before launching.</p>}
        </section>
      )}

      {!isDraft && (
      <section className="card">
        <h2>Progress</h2>
        <ul className="progress-list">
          {progress.map((p) => (
            <li key={p.id}>
              <span className="progress-name">{p.name}{p.id === me.id && ' (you)'}</span>
              <span className="bar"><span style={{ width: total ? `${(p.count / total) * 100}%` : 0 }} /></span>
              <span className="small muted">{p.count}/{total}</span>
            </li>
          ))}
        </ul>
      </section>
      )}

      <h2>Prompts</h2>
      {prompts.length === 0 && <p className="muted">No prompts yet.</p>}
      <ol className="prompts">
        {prompts.map((prompt, i) => {
          const mine = myEntries.get(prompt.id) ?? null;
          const others = entries.filter((e) => e.prompt_id === prompt.id && e.user_id !== me.id);
          const open = expanded[prompt.id];
          return (
            <li key={prompt.id} className={`prompt card ${mine ? 'done' : ''}`}>
              <div className="prompt-head">
                <span className="prompt-num">{i + 1}</span>
                <div className="grow">
                  <h3>{prompt.title}</h3>
                  {prompt.description && <p className="small muted">{prompt.description}</p>}
                </div>
              </div>

              {mine ? (
                <div className="my-entry">
                  <BookCover book={mine.books} />
                  <div className="grow">
                    <strong>{mine.books?.title}</strong>
                    {mine.books?.author && <div className="small muted">{mine.books.author}</div>}
                    <div className="small">
                      {mine.rating && '★'.repeat(mine.rating)}
                      {mine.finished_on && <span className="muted"> · finished {new Date(mine.finished_on + 'T00:00:00').toLocaleDateString()}</span>}
                    </div>
                    {mine.notes && <p className="small notes">{mine.notes}</p>}
                  </div>
                  <button className="link" onClick={() => setLogging({ prompt, entry: mine })}>Edit</button>
                </div>
              ) : isDraft ? null : (
                <button className="primary" onClick={() => setLogging({ prompt, entry: null })}>Log a book</button>
              )}

              {others.length > 0 && (
                <div className="others">
                  <button className="link small" onClick={() => setExpanded({ ...expanded, [prompt.id]: !open })}>
                    {open ? 'Hide' : 'See'} what {others.length} {others.length === 1 ? 'other person' : 'others'} read
                  </button>
                  {open && (
                    <ul>
                      {others.map((e) => (
                        <li key={e.id}>
                          <BookCover book={e.books} small />
                          <div>
                            <strong>{e.books?.title}</strong>
                            {e.books?.author && <span className="muted"> — {e.books.author}</span>}
                            <div className="small muted">
                              {e.profiles?.display_name}
                              {e.rating && ` · ${'★'.repeat(e.rating)}`}
                            </div>
                            {e.notes && <p className="small notes">{e.notes}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {canManage && (
        <p><button className="link danger" onClick={deleteChallenge}>Delete this challenge</button></p>
      )}

      {logging && (
        <LogBookDialog
          challengeId={challenge.id}
          prompt={logging.prompt}
          existing={logging.entry}
          onClose={() => setLogging(null)}
          onSaved={() => {
            setLogging(null);
            data.reload();
          }}
        />
      )}
    </>
  );
}
