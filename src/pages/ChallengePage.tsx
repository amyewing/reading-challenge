import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useMe } from '../App';
import type { Book, BookTag, Challenge, Consideration, Entry, Member, Prompt } from '../lib/types';
import LogBookDialog from '../components/LogBookDialog';
import ConsiderDialog from '../components/ConsiderDialog';
import BookTagsDialog from '../components/BookTagsDialog';
import BookCover from '../components/BookCover';
import TagChips from '../components/TagChips';

type Dialog =
  | { kind: 'log'; prompt: Prompt; entry: Entry | null; book?: Book | null }
  | { kind: 'consider'; prompt: Prompt; consideration: Consideration | null; book?: Book | null }
  | { kind: 'tags'; book: Book };

export default function ChallengePage() {
  const { challengeId } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hideFinished, setHideFinished] = useState(false);

  const data = useAsync(
    () =>
      api<{
        challenge: Challenge & { group_name: string };
        prompts: Prompt[];
        entries: Entry[];
        considerations: Consideration[];
        members: Member[];
        bookTags: (BookTag & { book_id: string })[];
      }>(`/api/challenges/${challengeId}`),
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
  const considerations = data.data.considerations ?? [];
  // Tags by book (already sorted most-chosen first)
  const tagsByBook = new Map<string, BookTag[]>();
  for (const t of data.data.bookTags ?? []) tagsByBook.set(t.book_id, [...(tagsByBook.get(t.book_id) ?? []), t]);
  const bookTags = (book: Book | null) =>
    book && <TagChips tags={tagsByBook.get(book.id) ?? []} max={4} onEdit={() => setDialog({ kind: 'tags', book })} />;
  const canManage = !!challenge.can_manage;
  const isDraft = challenge.status === 'draft';
  // Your logged books, by prompt (several books can count toward one prompt)
  const myEntries = new Map<string, Entry[]>();
  for (const e of entries) {
    if (e.user_id === me.id) myEntries.set(e.prompt_id, [...(myEntries.get(e.prompt_id) ?? []), e]);
  }
  const total = prompts.length;

  const progress = members
    .map((m) => {
      const read = new Set(entries.filter((e) => e.user_id === m.user_id).map((e) => e.prompt_id));
      const planned = new Set(
        considerations.filter((c) => c.user_id === m.user_id && !read.has(c.prompt_id)).map((c) => c.prompt_id),
      );
      return { id: m.user_id, name: m.profiles?.display_name ?? 'Reader', count: read.size, planned: planned.size };
    })
    .sort((a, b) => b.count - a.count || b.planned - a.planned || a.name.localeCompare(b.name));
  const anyPlanned = progress.some((p) => p.planned > 0);

  const visiblePrompts = prompts
    .map((prompt, i) => ({ prompt, number: i + 1 }))
    .filter(({ prompt }) => !hideFinished || !myEntries.has(prompt.id));

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
                <span
                  className="bar"
                  title={`${p.count} read${p.planned ? `, ${p.planned} more with books in mind` : ''}`}
                >
                  <span className="bar-done" style={{ width: total ? `${(p.count / total) * 100}%` : 0 }} />
                  <span className="bar-planned" style={{ width: total ? `${(p.planned / total) * 100}%` : 0 }} />
                </span>
                <span className="small muted">{p.count}/{total}</span>
              </li>
            ))}
          </ul>
          {anyPlanned && (
            <p className="small muted legend">
              <span className="swatch swatch-done" /> read <span className="swatch swatch-planned" /> has a book in mind
            </p>
          )}
        </section>
      )}

      <div className="section-head">
        <h2>Prompts</h2>
        {!isDraft && myEntries.size > 0 && (
          <label className="toggle small">
            <input type="checkbox" checked={hideFinished} onChange={(e) => setHideFinished(e.target.checked)} />
            Hide prompts I've finished
          </label>
        )}
      </div>
      <p className="small muted">
        Planning ahead? Use <strong>Consider a book</strong> to jot down books that might fit a prompt, and why. Your
        group can see your list, and you can see theirs.
      </p>
      {prompts.length === 0 && <p className="muted">No prompts yet.</p>}
      {hideFinished && visiblePrompts.length === 0 && <p className="muted">You've finished every prompt. 🎉</p>}
      <ol className="prompts">
        {visiblePrompts.map(({ prompt, number }) => {
          const mine = myEntries.get(prompt.id) ?? [];
          const done = mine.length > 0;
          const myList = considerations.filter((c) => c.prompt_id === prompt.id && c.user_id === me.id);
          const othersRead = entries.filter((e) => e.prompt_id === prompt.id && e.user_id !== me.id);
          const othersConsidering = considerations.filter((c) => c.prompt_id === prompt.id && c.user_id !== me.id);
          const onMyList = new Set([...myList, ...mine].map((x) => x.books?.id).filter(Boolean));
          const othersCount = othersRead.length + othersConsidering.length;
          const open = expanded[prompt.id];

          const addToMyList = (book: Book | null) =>
            book &&
            !onMyList.has(book.id) && (
              <button
                className="link small add-idea"
                onClick={() => setDialog({ kind: 'consider', prompt, consideration: null, book })}
              >
                + Consider this
              </button>
            );

          return (
            <li key={prompt.id} className={`prompt card ${done ? 'done' : ''}`}>
              <div className="prompt-head">
                <span className="prompt-num">{number}</span>
                <div className="grow">
                  <h3>{prompt.title}</h3>
                  {prompt.description && <p className="small muted">{prompt.description}</p>}
                </div>
              </div>

              {mine.length > 0 && (
                <ul className="my-entries">
                  {mine.map((entry) => (
                    <li key={entry.id} className="my-entry">
                      <BookCover book={entry.books} />
                      <div className="grow">
                        <strong>{entry.books?.title}</strong>
                        {entry.books?.author && <div className="small muted">{entry.books.author}</div>}
                        <div className="small">
                          {entry.rating && '★'.repeat(entry.rating)}
                          {entry.finished_on && (
                            <span className="muted"> · finished {new Date(entry.finished_on + 'T00:00:00').toLocaleDateString()}</span>
                          )}
                        </div>
                        {entry.notes && <p className="small notes">{entry.notes}</p>}
                        {bookTags(entry.books)}
                      </div>
                      <button className="link" onClick={() => setDialog({ kind: 'log', prompt, entry })}>Edit</button>
                    </li>
                  ))}
                </ul>
              )}

              {myList.length > 0 && (
                <div className="considering mine">
                  <p className="eyebrow">{done ? 'Also on your list' : 'You’re considering'}</p>
                  <ul>
                    {myList.map((c) => (
                      <li key={c.id}>
                        <BookCover book={c.books} small />
                        <div className="grow">
                          <strong>{c.books?.title}</strong>
                          {c.books?.author && <span className="muted"> — {c.books.author}</span>}
                          {c.reason && <p className="small notes">{c.reason}</p>}
                          {bookTags(c.books)}
                        </div>
                        <div className="row idea-actions">
                          {!isDraft && (
                            <button
                              className="small"
                              onClick={() => setDialog({ kind: 'log', prompt, entry: null, book: c.books })}
                            >
                              I read it
                            </button>
                          )}
                          <button
                            className="link small"
                            onClick={() => setDialog({ kind: 'consider', prompt, consideration: c })}
                          >
                            Edit
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={`row prompt-actions ${done ? 'quiet' : ''}`}>
                {!isDraft && (
                  <button
                    className={done ? '' : 'primary'}
                    onClick={() => setDialog({ kind: 'log', prompt, entry: null })}
                  >
                    {done ? '+ Log another book' : 'Log a book'}
                  </button>
                )}
                <button onClick={() => setDialog({ kind: 'consider', prompt, consideration: null })}>
                  {done ? '+ Consider another' : 'Consider a book'}
                </button>
              </div>

              {othersCount > 0 && (
                <div className="others">
                  <button className="link small" onClick={() => setExpanded({ ...expanded, [prompt.id]: !open })}>
                    {open ? 'Hide' : 'See'} what others{' '}
                    {[
                      othersRead.length > 0 && `read (${othersRead.length})`,
                      othersConsidering.length > 0 && `are considering (${othersConsidering.length})`,
                    ]
                      .filter(Boolean)
                      .join(' and ')}
                  </button>
                  {open && (
                    <>
                      {othersRead.length > 0 && (
                        <>
                          <p className="eyebrow others-label">Read</p>
                          <ul>
                            {othersRead.map((e) => (
                              <li key={e.id}>
                                <BookCover book={e.books} small />
                                <div className="grow">
                                  <strong>{e.books?.title}</strong>
                                  {e.books?.author && <span className="muted"> — {e.books.author}</span>}
                                  <div className="small muted">
                                    {e.profiles?.display_name}
                                    {e.rating && ` · ${'★'.repeat(e.rating)}`}
                                  </div>
                                  {e.notes && <p className="small notes">{e.notes}</p>}
                                  {bookTags(e.books)}
                                </div>
                                {addToMyList(e.books)}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      {othersConsidering.length > 0 && (
                        <>
                          <p className="eyebrow others-label">Considering</p>
                          <ul>
                            {othersConsidering.map((c) => (
                              <li key={c.id}>
                                <BookCover book={c.books} small />
                                <div className="grow">
                                  <strong>{c.books?.title}</strong>
                                  {c.books?.author && <span className="muted"> — {c.books.author}</span>}
                                  <div className="small muted">{c.profiles?.display_name}</div>
                                  {c.reason && <p className="small notes">{c.reason}</p>}
                                  {bookTags(c.books)}
                                </div>
                                {addToMyList(c.books)}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </>
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

      {dialog?.kind === 'log' && (
        <LogBookDialog
          prompt={dialog.prompt}
          existing={dialog.entry}
          initialBook={dialog.book}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            data.reload();
          }}
        />
      )}
      {dialog?.kind === 'tags' && (
        <BookTagsDialog
          book={dialog.book}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            data.reload();
          }}
        />
      )}
      {dialog?.kind === 'consider' && (
        <ConsiderDialog
          prompt={dialog.prompt}
          existing={dialog.consideration}
          initialBook={dialog.book}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            data.reload();
          }}
        />
      )}
    </>
  );
}
