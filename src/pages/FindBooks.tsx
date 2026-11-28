import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { refreshTags, useTags } from '../lib/tags';
import type { Book, BookTag } from '../lib/types';
import BookCover from '../components/BookCover';
import ChatMessage from '../components/ChatMessage';
import FindItLinks from '../components/FindItLinks';
import TagChips from '../components/TagChips';
import TagPicker from '../components/TagPicker';
import BookTagsDialog from '../components/BookTagsDialog';

interface Activity {
  display_name: string;
  prompt_title: string;
  challenge_id: string;
  challenge_title: string;
  rating?: number | null;
  reason?: string | null;
}

/** A message about this book, from a challenge in one of your groups */
interface Discussion {
  id: string;
  body: string;
  spoiler: boolean;
  created_at: string;
  user_id: string;
  display_name: string;
  prompt_id: string;
  prompt_title: string;
  challenge_id: string;
  challenge_title: string;
}

interface BookResult extends Book {
  tags: BookTag[];
  reads: Activity[];
  considering: Activity[];
  discussion_count: number;
  /** The latest few messages */
  discussions: Discussion[];
}

/** Find books by tag (all selected tags must match) and/or title or author. */
export default function FindBooks() {
  const [params, setParams] = useSearchParams();
  const tagIds = (params.get('tags') ?? '').split(',').filter(Boolean);
  const q = params.get('q') ?? '';
  const [text, setText] = useState(q);
  const [results, setResults] = useState<BookResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tagging, setTagging] = useState<Book | null>(null);
  const [showFilters, setShowFilters] = useState(tagIds.length === 0);
  const [reloadKey, setReloadKey] = useState(0);
  const { tags } = useTags();
  const tagName = (id: string) => tags?.find((t) => t.id === id)?.name ?? '…';

  function update(next: { tags?: string[]; q?: string }) {
    const p = new URLSearchParams();
    const t = next.tags ?? tagIds;
    const words = next.q ?? q;
    if (t.length) p.set('tags', t.join(','));
    if (words.trim()) p.set('q', words.trim());
    setParams(p, { replace: true });
  }

  // Fresh tag counts each time the page opens
  useEffect(() => {
    refreshTags().catch(() => undefined);
  }, []);

  // Search as the text changes (debounced)
  useEffect(() => {
    if (text === q) return;
    const t = setTimeout(() => update({ q: text }), 350);
    return () => clearTimeout(t);
  }, [text]);

  // Keep the box in step when the URL changes (e.g. clicking a tag on a book)
  useEffect(() => {
    if (q !== text.trim()) setText(q);
  }, [q]);

  const key = `${tagIds.join(',')}|${q}`;
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    api<BookResult[]>('/api/books/search', { method: 'POST', body: { tagIds, q: q || null } })
      .then((r) => live && setResults(r))
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [key, reloadKey]);

  const filtering = tagIds.length > 0 || q.trim().length > 0;

  return (
    <>
      <p className="crumbs"><Link to="/">Groups</Link> /</p>
      <h1>Find books</h1>
      <p className="muted">
        Look for books by tag, title or author. Results show every book anyone has tagged, plus what people in your
        groups have read, are considering or have been discussing.
      </p>

      <section className="card find-filters">
        <label>
          Title or author
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Kingsolver" />
        </label>

        <div className="section-head find-tags-head">
          <span className="label-text">
            Tags {tagIds.length > 1 && <span className="muted">(books with all of these)</span>}
          </span>
          <button type="button" className="link small" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Hide tag list' : 'Choose tags'}
          </button>
        </div>
        {!showFilters && tagIds.length > 0 && (
          <div className="tag-row">
            {tagIds.map((id) => (
              <button
                key={id}
                type="button"
                className="tag-chip on"
                onClick={() => update({ tags: tagIds.filter((x) => x !== id) })}
                aria-label={`Remove ${tagName(id)}`}
              >
                {tagName(id)} <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        )}
        {showFilters && (
          <TagPicker selected={tagIds} onChange={(ids) => update({ tags: ids })} allowCreate={false} onlyUsed />
        )}
        {filtering && (
          <button type="button" className="link small" onClick={() => { setText(''); update({ tags: [], q: '' }); }}>
            Clear search
          </button>
        )}
      </section>

      {error && <p className="error">{error}</p>}
      {loading && !results && <p className="muted">Searching…</p>}
      {results && (
        <>
          <p className="small muted">
            {results.length === 0
              ? filtering
                ? 'No books match yet. Try fewer tags, or tag some books yourself.'
                : 'No books yet. Log or consider a book in a challenge, or tag one, and it will show up here.'
              : `${results.length === 60 ? 'First 60' : results.length} ${results.length === 1 ? 'book' : 'books'}`}
            {loading && ' · updating…'}
          </p>
          <ul className="book-results">
            {results.map((b) => (
              <li key={b.id} className="card book-result">
                <BookCover book={b} onChanged={() => setReloadKey((k) => k + 1)} />
                <div className="grow">
                  <strong>{b.title}</strong>
                  {b.author && (
                    <button type="button" className="link small author-link" onClick={() => setText(b.author!)}>
                      {b.author}
                    </button>
                  )}
                  <TagChips tags={b.tags} max={8} active={tagIds} onEdit={() => setTagging(b)} />
                  <FindItLinks book={b} variant="inline" />
                  {b.reads.length > 0 && (
                    <ul className="activity">
                      {b.reads.map((r, i) => (
                        <li key={`r${i}`} className="small">
                          <strong>{r.display_name}</strong> read it for “{r.prompt_title}”
                          {r.rating ? ` · ${'★'.repeat(r.rating)}` : ''}{' '}
                          <Link className="muted" to={`/challenges/${r.challenge_id}`}>{r.challenge_title}</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {b.considering.length > 0 && (
                    <ul className="activity">
                      {b.considering.map((r, i) => (
                        <li key={`c${i}`} className="small">
                          <strong>{r.display_name}</strong> is considering it for “{r.prompt_title}”{' '}
                          <Link className="muted" to={`/challenges/${r.challenge_id}`}>{r.challenge_title}</Link>
                          {r.reason && <span className="muted"> · {r.reason}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {b.discussion_count > 0 && (
                    <div className="discussion-found">
                      <p className="eyebrow">
                        Discussion ({b.discussion_count})
                        {b.discussion_count > b.discussions.length && ` · latest ${b.discussions.length}`}
                      </p>
                      <div className="chat-list">
                        {b.discussions.map((d) => (
                          <ChatMessage
                            key={d.id}
                            userId={d.user_id}
                            name={d.display_name}
                            body={d.body}
                            spoiler={d.spoiler}
                            createdAt={d.created_at}
                          >
                            <p className="small muted message-where">
                              for “{d.prompt_title}” in {d.challenge_title} ·{' '}
                              <Link to={`/challenges/${d.challenge_id}?discuss=${d.prompt_id}&book=${b.id}`}>
                                Join the discussion
                              </Link>
                            </p>
                          </ChatMessage>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {tagging && (
        <BookTagsDialog
          book={tagging}
          onClose={() => setTagging(null)}
          onSaved={() => {
            setTagging(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}
