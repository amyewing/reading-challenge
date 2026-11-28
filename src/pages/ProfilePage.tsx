import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useMe, useRenameMe } from '../App';
import type { Book, Consideration, Role } from '../lib/types';
import Avatar from '../components/Avatar';
import BookCover from '../components/BookCover';
import EditProfileDialog from '../components/EditProfileDialog';
import FindItLinks from '../components/FindItLinks';
import MiniBar from '../components/MiniBar';
import ReadingProgressDialog from '../components/ReadingProgressDialog';
import RichText from '../components/RichText';

interface ProfileGroup {
  id: string;
  name: string;
  description: string | null;
  role: Role;
  member_count: number;
}

interface ProfileChallenge {
  id: string;
  group_id: string;
  group_name: string;
  title: string;
  status: 'draft' | 'active';
  starts_on: string | null;
  ends_on: string | null;
  prompt_count: number;
  read_count: number;
  reading_count: number;
  considering_count: number;
}

interface WithPrompt {
  prompt_id: string;
  prompt_title: string;
  challenge_id: string;
  challenge_title: string;
  books: Book;
}

interface ProfileEntry extends WithPrompt {
  id: string;
  finished_on: string | null;
  rating: number | null;
  notes: string | null;
}

interface ProfileConsideration extends WithPrompt {
  id: string;
  status: 'considering' | 'reading';
  progress: number | null;
  started_on: string | null;
  reason: string | null;
  created_at: string;
}

interface Profile {
  person: {
    id: string;
    display_name: string;
    avatar: string | null;
    avatar_preset: string | null;
    featured_book: Book | null;
    featured_note: string | null;
  };
  groups: ProfileGroup[];
  challenges: ProfileChallenge[];
  entries: ProfileEntry[];
  considerations: ProfileConsideration[];
}

/** Rows with the same book together, in the order each book first appears */
function groupByBook<T extends { books: Book }>(rows: T[]) {
  const groups = new Map<string, { book: Book; rows: T[] }>();
  for (const row of rows) {
    const existing = groups.get(row.books.id);
    if (existing) existing.rows.push(row);
    else groups.set(row.books.id, { book: row.books, rows: [row] });
  }
  return [...groups.values()];
}

const formatDate = (d: string, withYear = true) =>
  new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined });

/** Scroll smoothly to a part of the page (without adding a step to the browser history) */
function jumpTo(id: string) {
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
}

/** After a long list: a way back up to the jump links */
function BackToJumpLinks({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="back-to-top small">
      <button type="button" className="link" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        Back to the numbers at the top
      </button>
    </p>
  );
}

const LONG_LIST = 5;

/** "for *prompt* in *challenge*", with the challenge linking to its page */
function Where({ row }: { row: WithPrompt }) {
  return (
    <>
      for “{row.prompt_title}” in <Link to={`/challenges/${row.challenge_id}`}>{row.challenge_title}</Link>
    </>
  );
}

export default function ProfilePage() {
  const { userId } = useParams();
  const me = useMe();
  const renameMe = useRenameMe();
  const [updating, setUpdating] = useState<ProfileConsideration | null>(null);
  const [editing, setEditing] = useState(false);

  const data = useAsync(() => api<Profile>(`/api/people/${encodeURIComponent(userId ?? '')}`), [userId]);

  if (data.loading && !data.data) return <p className="muted">Loading…</p>;
  if (data.error || !data.data)
    return (
      <p>
        <span className="error">{data.error}</span> <Link to="/">Go home</Link>
      </p>
    );

  const { person, groups, challenges, entries, considerations } = data.data;
  const isMe = person.id === me.id;
  const readBooks = groupByBook(entries);
  const readingBooks = groupByBook(considerations.filter((c) => c.status === 'reading'));
  const consideringBooks = groupByBook(considerations.filter((c) => c.status === 'considering'));
  const whose = isMe ? 'your' : `${person.display_name}’s`;

  return (
    <>
      <p className="crumbs"><Link to="/">Groups</Link> /</p>
      <div className="profile-head">
        <Avatar name={person.display_name} src={person.avatar} preset={person.avatar_preset} />
        <div className="grow">
          <h1>{person.display_name}{isMe && ' (you)'}</h1>
          {isMe && <button onClick={() => setEditing(true)}>Edit profile</button>}
        </div>
      </div>
      {!isMe && <p className="small muted">You can see the groups and challenges you share with {person.display_name}.</p>}

      {person.featured_book ? (
        <section className="card featured" id="profile-featured">
          <BookCover book={person.featured_book} />
          <div className="grow">
            <p className="eyebrow">{isMe ? 'Currently featuring' : `${person.display_name} is featuring`}</p>
            <h3>{person.featured_book.title}</h3>
            {person.featured_book.author && <p className="muted">{person.featured_book.author}</p>}
            {person.featured_note && <RichText text={person.featured_note} clamp className="featured-note" />}
            <FindItLinks book={person.featured_book} variant="inline" />
          </div>
          {isMe && <button className="link small" onClick={() => setEditing(true)}>Change</button>}
        </section>
      ) : (
        isMe && (
          <section className="card featured-empty">
            <p className="muted">Is there a book you love right now? Feature it here and say why.</p>
            <button onClick={() => setEditing(true)}>Feature a book</button>
          </section>
        )
      )}

      <nav className="card stat-strip" aria-label="Jump to a section">
        {[
          { id: 'profile-read', n: readBooks.length, label: readBooks.length === 1 ? 'book read' : 'books read' },
          { id: 'profile-reading', n: readingBooks.length, label: 'reading' },
          { id: 'profile-considering', n: consideringBooks.length, label: 'considering' },
          { id: 'profile-challenges', n: challenges.length, label: challenges.length === 1 ? 'challenge' : 'challenges' },
          { id: 'profile-groups', n: groups.length, label: groups.length === 1 ? 'group' : 'groups' },
        ].map((s) => (
          <button key={s.id} type="button" className="stat" disabled={s.n === 0} onClick={() => jumpTo(s.id)}>
            <strong>{s.n}</strong>
            <span>{s.label}</span>
          </button>
        ))}
      </nav>

      {readingBooks.length > 0 && (
        <section className="card" id="profile-reading">
          <div className="strip red">Reading now</div>
          <ul className="book-list">
            {readingBooks.map(({ book, rows }) => (
              <li key={book.id}>
                <BookCover book={book} small />
                <div className="grow">
                  <strong>{book.title}</strong>
                  {book.author && <span className="muted"> — {book.author}</span>}
                  <div className="reading-line small muted">
                    <MiniBar percent={rows[0].progress} />
                    <span>
                      about {rows[0].progress ?? 0}%
                      {rows[0].started_on && ` · started ${formatDate(rows[0].started_on, false)}`}
                    </span>
                  </div>
                  {rows.map((r) => (
                    <p key={r.id} className="small muted book-where"><Where row={r} /></p>
                  ))}
                </div>
                {isMe && <button className="small" onClick={() => setUpdating(rows[0])}>Update</button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" id="profile-read">
        <div className="strip">Read</div>
        {readBooks.length === 0 && <p className="muted">No books read yet.</p>}
        <ul className="book-list">
          {readBooks.map(({ book, rows }) => {
            const rating = rows.map((r) => r.rating).find((r) => r != null);
            return (
              <li key={book.id}>
                <BookCover book={book} small />
                <div className="grow">
                  <strong>{book.title}</strong>
                  {book.author && <span className="muted"> — {book.author}</span>}
                  {rating != null && <div className="small">{'★'.repeat(rating)}</div>}
                  {rows.map((r) => (
                    <div key={r.id} className="book-where">
                      <p className="small muted">
                        <Where row={r} />
                        {r.finished_on && ` · finished ${formatDate(r.finished_on)}`}
                      </p>
                      {r.notes && <p className="small notes">{r.notes}</p>}
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <BackToJumpLinks show={readBooks.length > LONG_LIST} />
      </section>

      <section className="card" id="profile-considering">
        <div className="strip">Considering</div>
        {consideringBooks.length === 0 && <p className="muted">Nothing on {whose} list right now.</p>}
        <ul className="book-list">
          {consideringBooks.map(({ book, rows }) => (
            <li key={book.id}>
              <BookCover book={book} small />
              <div className="grow">
                <strong>{book.title}</strong>
                {book.author && <span className="muted"> — {book.author}</span>}
                {rows.map((r) => (
                  <div key={r.id} className="book-where">
                    <p className="small muted"><Where row={r} /></p>
                    {r.reason && <p className="small notes">{r.reason}</p>}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <BackToJumpLinks show={consideringBooks.length > LONG_LIST} />
      </section>

      <div className="section-head" id="profile-challenges"><h2>Challenges</h2></div>
      {challenges.length === 0 && <p className="muted">No challenges yet.</p>}
      <div className="cards">
        {challenges.map((c) => {
          const pct = (n: number) => (c.prompt_count ? `${(n / c.prompt_count) * 100}%` : 0);
          return (
            <Link key={c.id} to={`/challenges/${c.id}`} className="card card-link">
              <div className={`strip ${c.status === 'draft' ? 'gold' : ''}`}>
                <span>{c.group_name}</span>
                {c.status === 'draft' && <span>Draft</span>}
              </div>
              <h3>{c.title}</h3>
              <span className="bar">
                <span className="bar-done" style={{ width: pct(c.read_count) }} />
                <span className="bar-reading" style={{ width: pct(c.reading_count) }} />
                <span className="bar-planned" style={{ width: pct(c.considering_count) }} />
              </span>
              <p className="small muted">
                {c.read_count} of {c.prompt_count} read
                {c.reading_count > 0 && ` · ${c.reading_count} reading`}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="section-head" id="profile-groups"><h2>Groups</h2></div>
      <div className="cards">
        {groups.map((g) => (
          <Link key={g.id} to={`/groups/${g.id}`} className="card card-link">
            <div className="strip">
              <span>{g.member_count} {g.member_count === 1 ? 'member' : 'members'}</span>
              {g.role !== 'member' && <span>{g.role}</span>}
            </div>
            <h3>{g.name}</h3>
            {g.description && <p className="muted">{g.description}</p>}
          </Link>
        ))}
      </div>

      {editing && (
        <EditProfileDialog
          person={person}
          onClose={() => setEditing(false)}
          onSaved={(name) => {
            setEditing(false);
            renameMe(name);
            data.reload();
          }}
        />
      )}
      {updating && (
        <ReadingProgressDialog
          prompt={{ id: updating.prompt_id, position: 0, title: updating.prompt_title, description: null }}
          consideration={
            {
              id: updating.id,
              prompt_id: updating.prompt_id,
              user_id: person.id,
              reason: updating.reason,
              created_at: updating.created_at,
              status: updating.status,
              progress: updating.progress,
              started_on: updating.started_on,
              books: updating.books,
              profiles: null,
            } satisfies Consideration
          }
          onClose={() => setUpdating(null)}
          onSaved={() => {
            setUpdating(null);
            data.reload();
          }}
        />
      )}
    </>
  );
}
