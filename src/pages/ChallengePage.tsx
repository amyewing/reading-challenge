import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useMe } from '../App';
import type { Book, BookTag, Challenge, Consideration, Entry, Member, MessageCount, Prompt } from '../lib/types';
import LogBookDialog from '../components/LogBookDialog';
import ConsiderDialog from '../components/ConsiderDialog';
import ReadingProgressDialog from '../components/ReadingProgressDialog';
import PromptChat from '../components/PromptChat';
import RichText from '../components/RichText';
import MiniBar from '../components/MiniBar';
import PersonLink from '../components/PersonLink';
import BookTagsDialog from '../components/BookTagsDialog';
import Avatar from '../components/Avatar';
import BookCover from '../components/BookCover';
import TagChips from '../components/TagChips';
import FindItLinks from '../components/FindItLinks';
import { ChatBubbleIcon } from '../components/Icon';

/** The date stamp on a finished prompt: "Read 14 Mar 2027" (latest finish date), or just "Read" */
function readStamp(entries: Entry[]) {
  const latest = entries
    .map((e) => e.finished_on)
    .filter((d): d is string => !!d)
    .sort()
    .pop();
  if (!latest) return 'Read';
  const d = new Date(latest + 'T00:00:00');
  return `Read ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })} ${d.getFullYear()}`;
}

/** A book that has a thread here but is no longer on the prompt: its title and discussion button on one line */
function AlsoDiscussed({ title, button, thread }: { title: string; button: ReactNode; thread: ReactNode }) {
  return (
    <>
      <div className="book-actions">
        <strong className="small">{title}</strong>
        {button}
      </div>
      {thread}
    </>
  );
}

type Dialog =
  | { kind: 'log'; prompt: Prompt; entry: Entry | null; book?: Book | null }
  | { kind: 'consider'; prompt: Prompt; consideration: Consideration | null; book?: Book | null; reading?: boolean }
  | { kind: 'reading'; prompt: Prompt; consideration: Consideration }
  | { kind: 'tags'; book: Book };


export default function ChallengePage() {
  const { challengeId } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  // A link like ?discuss=<prompt>&book=<book> (from Find books) opens that book's thread
  const [search] = useSearchParams();
  const linkPrompt = search.get('discuss');
  const linkBook = search.get('book');
  const [expanded, setExpanded] = useState<Record<string, boolean>>(linkPrompt && linkBook ? { [linkPrompt]: true } : {});
  const [hideFinished, setHideFinished] = useState(false);
  // Prompts whose general discussion is open
  const [chat, setChat] = useState<Record<string, boolean | undefined>>({});
  // Open book threads, by "promptId:bookId": the row each is shown under ('first' = the first row with that book)
  const [threads, setThreads] = useState<Record<string, string | undefined>>(
    linkPrompt && linkBook ? { [`${linkPrompt}:${linkBook}`]: 'first' } : {},
  );
  const scrolledToLink = useRef(false);

  const data = useAsync(
    () =>
      api<{
        challenge: Challenge & { group_name: string };
        prompts: Prompt[];
        entries: Entry[];
        considerations: Consideration[];
        members: Member[];
        bookTags: (BookTag & { book_id: string })[];
        messageCounts: MessageCount[];
      }>(`/api/challenges/${challengeId}`),
    [challengeId],
  );

  // Bring a linked thread into view once the page has loaded
  useEffect(() => {
    if (!data.data || scrolledToLink.current || !linkPrompt || !linkBook) return;
    scrolledToLink.current = true;
    setTimeout(() => {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById(`thread-${linkPrompt}-${linkBook}`)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
    }, 150);
  }, [data.data]);

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
  const canManage = !!challenge.can_manage;
  const isDraft = challenge.status === 'draft';
  // Your logged books, by prompt (several books can count toward one prompt)
  const myEntries = new Map<string, Entry[]>();
  for (const e of entries) {
    if (e.user_id === me.id) myEntries.set(e.prompt_id, [...(myEntries.get(e.prompt_id) ?? []), e]);
  }
  const total = prompts.length;

  // Discussion counts: the prompt's general thread (no book), and each book's thread on it
  const messageCounts = data.data.messageCounts ?? [];
  const promptMessages = (promptId: string) => {
    const row = messageCounts.find((c) => c.prompt_id === promptId && c.book_id === null);
    return { count: row?.count ?? 0, unread: row?.unread ?? 0 };
  };
  const bookMessages = (promptId: string, bookId: string) => {
    const row = messageCounts.find((c) => c.prompt_id === promptId && c.book_id === bookId);
    return { count: row?.count ?? 0, unread: row?.unread ?? 0 };
  };

  // Book threads open under the row they were opened from; a book can appear in several rows
  // (yours and other people's), so only one shows the thread at a time.
  const threadKey = (promptId: string, bookId: string) => `${promptId}:${bookId}`;
  const seenThreads = new Set<string>(); // threads already offered a row in this render
  const toggleThread = (key: string, rowId: string, isOpen: boolean) =>
    setThreads({ ...threads, [key]: isOpen ? undefined : rowId });

  /**
   * The discussion button for a book ("Discussion (3 · 1 new)", with a speech bubble) and, when
   * open, that book's own thread. rowId says which row it is under, as the same book can be listed
   * more than once. The button and thread are returned apart so the button can sit in a row.
   */
  const discussion = (prompt: Prompt, book: Book, rowId: string) => {
    const key = threadKey(prompt.id, book.id);
    const first = !seenThreads.has(key);
    seenThreads.add(key);
    const isOpen = threads[key] === rowId || (threads[key] === 'first' && first);
    const { count, unread } = bookMessages(prompt.id, book.id);
    const button = (
      <button
        type="button"
        className={`pill-button ${unread > 0 ? 'has-new' : ''}`}
        aria-expanded={isOpen}
        onClick={() => toggleThread(key, rowId, isOpen)}
      >
        <ChatBubbleIcon />
        {isOpen
          ? 'Hide discussion'
          : `Discussion${count > 0 ? ` (${count}${unread > 0 ? ` · ${unread} new` : ''})` : ''}`}
      </button>
    );
    const thread = isOpen && (
          <div className="book-thread" id={`thread-${prompt.id}-${book.id}`}>
            <PromptChat
              key={key}
              promptId={prompt.id}
              book={book}
              myId={me.id}
              canModerate={canManage}
              unread={unread}
              onChanged={data.reload}
            />
          </div>
    );
    return { button, thread };
  };

  /**
   * One compact line under a book: its top tags, "+ Tags", and the discussion button, side by
   * side, with the book's thread underneath when it is open.
   */
  const bookActions = (prompt: Prompt, book: Book | null, rowId: string) => {
    if (!book) return null;
    const tags = tagsByBook.get(book.id) ?? [];
    const { button, thread } = discussion(prompt, book, rowId);
    return (
      <>
        <div className="book-actions">
          <TagChips tags={tags} max={3} inline />
          <button
            type="button"
            className="pill-button"
            title="Tag this book with genres, moods and more"
            onClick={() => setDialog({ kind: 'tags', book })}
          >
            {tags.some((t) => t.mine) ? 'Edit tags' : '+ Tags'}
          </button>
          {button}
          <FindItLinks book={book} />
        </div>
        {thread}
      </>
    );
  };

  const progress = members
    .map((m) => {
      const read = new Set(entries.filter((e) => e.user_id === m.user_id).map((e) => e.prompt_id));
      const readingNow = considerations.filter((c) => c.user_id === m.user_id && c.status === 'reading' && !read.has(c.prompt_id));
      const readingPrompts = new Set(readingNow.map((c) => c.prompt_id));
      const planned = new Set(
        considerations
          .filter((c) => c.user_id === m.user_id && !read.has(c.prompt_id) && !readingPrompts.has(c.prompt_id))
          .map((c) => c.prompt_id),
      );
      return {
        id: m.user_id,
        name: m.profiles?.display_name ?? 'Reader',
        avatar: m.profiles?.avatar,
        preset: m.profiles?.avatar_preset,
        count: read.size,
        reading: readingPrompts.size,
        readingNow,
        planned: planned.size,
      };
    })
    .sort(
      (a, b) =>
        b.count - a.count || b.reading - a.reading || b.planned - a.planned || a.name.localeCompare(b.name),
    );
  const anyPlanned = progress.some((p) => p.planned > 0);
  const anyReading = progress.some((p) => p.reading > 0);

  /** "Reading Piranesi · 40%", "Reading 2 books", or "Not started yet" */
  function progressNote(p: (typeof progress)[number]) {
    if (p.readingNow.length === 1) {
      const c = p.readingNow[0];
      return `Reading ${c.books?.title ?? 'a book'}${c.progress != null ? ` · ${c.progress}%` : ''}`;
    }
    if (p.readingNow.length > 1) return `Reading ${p.readingNow.length} books`;
    if (p.count > 0) return null;
    return p.planned > 0 ? 'Has books in mind, not started yet' : 'Not started yet';
  }

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
      {challenge.description && <RichText text={challenge.description} className="muted" />}
      {members.some((m) => m.user_id === challenge.created_by) && (
        <p className="small muted organiser">
          Organised by <PersonLink id={challenge.created_by} name={members.find((m) => m.user_id === challenge.created_by)?.profiles?.display_name} />
          {challenge.created_by === me.id && ' (you)'}
        </p>
      )}

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
          <div className="strip red">Progress</div>
          <ul className="progress-list">
            {progress.map((p) => {
              const note = progressNote(p);
              return (
                <li key={p.id}>
                  <span className="progress-name with-avatar">
                    <Avatar size="sm" name={p.name} src={p.avatar} preset={p.preset} />
                    <span className="progress-name-text"><PersonLink id={p.id} name={p.name} />{p.id === me.id && ' (you)'}</span>
                  </span>
                  <span
                    className="bar"
                    title={`${p.count} read${p.reading ? `, ${p.reading} being read` : ''}${p.planned ? `, ${p.planned} more with books in mind` : ''}`}
                  >
                    <span className="bar-done" style={{ width: total ? `${(p.count / total) * 100}%` : 0 }} />
                    <span className="bar-reading" style={{ width: total ? `${(p.reading / total) * 100}%` : 0 }} />
                    <span className="bar-planned" style={{ width: total ? `${(p.planned / total) * 100}%` : 0 }} />
                  </span>
                  <span className="small muted">{p.count}/{total}</span>
                  {note && <span className="progress-note small muted">{note}</span>}
                </li>
              );
            })}
          </ul>
          {(anyPlanned || anyReading) && (
            <p className="small muted legend">
              <span className="swatch swatch-done" /> read
              {anyReading && <><span className="swatch swatch-reading" /> reading</>}
              {anyPlanned && <><span className="swatch swatch-planned" /> has a book in mind</>}
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
          const myListAll = considerations.filter((c) => c.prompt_id === prompt.id && c.user_id === me.id);
          const myReading = myListAll.filter((c) => c.status === 'reading');
          const myList = myListAll.filter((c) => c.status !== 'reading');
          const othersRead = entries.filter((e) => e.prompt_id === prompt.id && e.user_id !== me.id);
          const othersAll = considerations.filter((c) => c.prompt_id === prompt.id && c.user_id !== me.id);
          const othersReading = othersAll.filter((c) => c.status === 'reading');
          const othersConsidering = othersAll.filter((c) => c.status !== 'reading');
          const onMyList = new Set([...myListAll, ...mine].map((x) => x.books?.id).filter(Boolean));
          const othersCount = othersRead.length + othersReading.length + othersConsidering.length;
          const open = expanded[prompt.id];
          const talk = promptMessages(prompt.id);
          const chatOpen = chat[prompt.id];
          // Books with a thread here that nobody has on this prompt any more (so no row to show it under)
          const booksOnPrompt = new Set(
            [...entries, ...considerations].filter((x) => x.prompt_id === prompt.id).map((x) => x.books?.id),
          );
          const alsoDiscussed = messageCounts.filter(
            (c) => c.prompt_id === prompt.id && c.book_id && c.books && !booksOnPrompt.has(c.book_id),
          );

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
              <div className="strip">
                <span>Prompt No. {number}</span>
                {done ? (
                  <span className="stamp">{readStamp(mine)}</span>
                ) : (
                  myReading.length > 0 && (
                    <span className="stamp stamp-reading">
                      Reading{myReading.length === 1 && myReading[0].progress != null ? ` ${myReading[0].progress}%` : ''}
                    </span>
                  )
                )}
              </div>
              <h3>{prompt.title}</h3>
              {prompt.description && (
                <div className="prompt-about">
                  <p className="eyebrow">About this prompt</p>
                  <RichText text={prompt.description} clamp className="small" />
                </div>
              )}

              {mine.length > 0 && (
                <ul className="my-entries">
                  {mine.map((entry) => (
                    <li key={entry.id} className="my-entry">
                      <BookCover book={entry.books} onChanged={data.reload} />
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
                        {bookActions(prompt, entry.books, `e-${entry.id}`)}
                      </div>
                      <button className="link" onClick={() => setDialog({ kind: 'log', prompt, entry })}>Edit</button>
                    </li>
                  ))}
                </ul>
              )}

              {myReading.length > 0 && (
                <div className="considering mine reading">
                  <p className="eyebrow">You’re reading</p>
                  <ul>
                    {myReading.map((c) => (
                      <li key={c.id}>
                        <BookCover book={c.books} small onChanged={data.reload} />
                        <div className="grow">
                          <strong>{c.books?.title}</strong>
                          {c.books?.author && <span className="muted"> — {c.books.author}</span>}
                          <div className="reading-line small muted">
                            <MiniBar percent={c.progress} />
                            <span>
                              about {c.progress ?? 0}%
                              {c.started_on && ` · started ${new Date(c.started_on + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
                            </span>
                          </div>
                          {c.reason && <p className="small notes">{c.reason}</p>}
                          {bookActions(prompt, c.books, `r-${c.id}`)}
                        </div>
                        <div className="row idea-actions">
                          {!isDraft && (
                            <button
                              className="small"
                              onClick={() => setDialog({ kind: 'log', prompt, entry: null, book: c.books })}
                            >
                              Finished it
                            </button>
                          )}
                          <button className="small" onClick={() => setDialog({ kind: 'reading', prompt, consideration: c })}>
                            Update
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {myList.length > 0 && (
                <div className="considering mine">
                  <p className="eyebrow">{done || myReading.length > 0 ? 'Also on your list' : 'You’re considering'}</p>
                  <ul>
                    {myList.map((c) => (
                      <li key={c.id}>
                        <BookCover book={c.books} small onChanged={data.reload} />
                        <div className="grow">
                          <strong>{c.books?.title}</strong>
                          {c.books?.author && <span className="muted"> — {c.books.author}</span>}
                          {c.reason && <p className="small notes">{c.reason}</p>}
                          {bookActions(prompt, c.books, `c-${c.id}`)}
                        </div>
                        <div className="row idea-actions">
                          {!isDraft && (
                            <button
                              className="small"
                              onClick={() => setDialog({ kind: 'reading', prompt, consideration: c })}
                            >
                              Start reading
                            </button>
                          )}
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
                {!isDraft && (
                  <button onClick={() => setDialog({ kind: 'consider', prompt, consideration: null, reading: true })}>
                    {done || myReading.length > 0 ? '+ Start another' : 'Start reading'}
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
                      othersReading.length > 0 && `are reading (${othersReading.length})`,
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
                                <BookCover book={e.books} small onChanged={data.reload} />
                                <div className="grow">
                                  <strong>{e.books?.title}</strong>
                                  {e.books?.author && <span className="muted"> — {e.books.author}</span>}
                                  <div className="small muted">
                                    <PersonLink id={e.user_id} name={e.profiles?.display_name} />
                                    {e.rating && ` · ${'★'.repeat(e.rating)}`}
                                  </div>
                                  {e.notes && <p className="small notes">{e.notes}</p>}
                                  {bookActions(prompt, e.books, `oe-${e.id}`)}
                                </div>
                                {addToMyList(e.books)}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      {othersReading.length > 0 && (
                        <>
                          <p className="eyebrow others-label">Reading</p>
                          <ul>
                            {othersReading.map((c) => (
                              <li key={c.id}>
                                <BookCover book={c.books} small onChanged={data.reload} />
                                <div className="grow">
                                  <strong>{c.books?.title}</strong>
                                  {c.books?.author && <span className="muted"> — {c.books.author}</span>}
                                  <div className="reading-line small muted">
                                    <MiniBar percent={c.progress} />
                                    <span><PersonLink id={c.user_id} name={c.profiles?.display_name} /> · about {c.progress ?? 0}%</span>
                                  </div>
                                  {bookActions(prompt, c.books, `or-${c.id}`)}
                                </div>
                                {addToMyList(c.books)}
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
                                <BookCover book={c.books} small onChanged={data.reload} />
                                <div className="grow">
                                  <strong>{c.books?.title}</strong>
                                  {c.books?.author && <span className="muted"> — {c.books.author}</span>}
                                  <div className="small muted"><PersonLink id={c.user_id} name={c.profiles?.display_name} /></div>
                                  {c.reason && <p className="small notes">{c.reason}</p>}
                                  {bookActions(prompt, c.books, `oc-${c.id}`)}
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

              <div className="discussion">
                <button
                  className="link small"
                  onClick={() => setChat({ ...chat, [prompt.id]: chatOpen ? undefined : true })}
                  aria-expanded={!!chatOpen}
                >
                  {chatOpen ? 'Hide discussion' : 'Discuss this prompt'}
                  {talk.count > 0 && ` (${talk.count}${talk.unread > 0 ? ` · ${talk.unread} new` : ''})`}
                </button>
                {chatOpen && (
                  <PromptChat
                    key={prompt.id}
                    promptId={prompt.id}
                    myId={me.id}
                    canModerate={canManage}
                    unread={talk.unread}
                    onChanged={data.reload}
                  />
                )}
                {alsoDiscussed.length > 0 && (
                  <>
                    <p className="small muted also-discussed-label">Also discussed:</p>
                    <ul className="also-discussed">
                      {alsoDiscussed.map((c) => (
                        <li key={c.book_id}>
                          <AlsoDiscussed title={c.books!.title} {...discussion(prompt, c.books!, `also-${c.book_id}`)} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
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
          reading={dialog.reading}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            data.reload();
          }}
        />
      )}
      {dialog?.kind === 'reading' && (
        <ReadingProgressDialog
          prompt={dialog.prompt}
          consideration={dialog.consideration}
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
