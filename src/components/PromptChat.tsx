import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { Book, PromptMessage } from '../lib/types';
import PersonLink from './PersonLink';

interface Props {
  promptId: string;
  /** Books on this prompt (read, reading or considered by anyone), so a message can be about one */
  books: Book[];
  /** Open already narrowed to one book, with the composer set to it */
  initialBookId?: string | null;
  myId: string;
  /** Organisers and group admins can delete anyone's message */
  canModerate: boolean;
  /** How many messages are new to you, so the page can refresh its counts once they are read */
  unread: number;
  /** Called when counts on the page may be out of date */
  onChanged: () => void;
}

const REFRESH_MS = 20_000;

function timeAgo(iso: string) {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} h ago`;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/** The discussion under a prompt: how to read the prompt, and thoughts on its books. */
export default function PromptChat({ promptId, books, initialBookId = null, myId, canModerate, unread, onChanged }: Props) {
  const [messages, setMessages] = useState<PromptMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(initialBookId);
  const [text, setText] = useState('');
  const [about, setAbout] = useState<string>(initialBookId ?? '');
  const [spoiler, setSpoiler] = useState(false);
  const [editing, setEditing] = useState<PromptMessage | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const rows = await api<PromptMessage[]>(`/api/prompts/${promptId}/messages`);
      setMessages(rows);
      setError(null);
      if (firstLoad.current) {
        firstLoad.current = false;
        if (unread > 0) onChanged();
      }
    } catch (e: any) {
      setError(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptId]);

  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Keep the newest message in view
  const shown = (messages ?? []).filter((m) => !filter || m.books?.id === filter);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length]);

  // A book someone tagged may no longer be on the list; keep it selectable while editing
  const options = [...books];
  for (const m of messages ?? []) if (m.books && !options.some((b) => b.id === m.books!.id)) options.push(m.books);
  const filterBook = filter ? options.find((b) => b.id === filter) : null;

  function startEdit(m: PromptMessage) {
    setEditing(m);
    setText(m.body);
    setAbout(m.books?.id ?? '');
    setSpoiler(m.spoiler);
  }

  function resetComposer() {
    setEditing(null);
    setText('');
    setSpoiler(false);
    setAbout(filter ?? '');
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const payload = { body, bookId: about || null, spoiler };
      if (editing) await api(`/api/messages/${editing.id}`, { method: 'PUT', body: payload });
      else await api(`/api/prompts/${promptId}/messages`, { method: 'POST', body: payload });
      resetComposer();
      await load();
      onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function remove(m: PromptMessage) {
    if (!confirm('Delete this message?')) return;
    try {
      await api(`/api/messages/${m.id}`, { method: 'DELETE' });
      if (editing?.id === m.id) resetComposer();
      await load();
      onChanged();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="chat">
      {filterBook && (
        <p className="small chat-filter">
          Showing messages about <strong>{filterBook.title}</strong>{' '}
          <button className="link" onClick={() => setFilter(null)}>Show all</button>
        </p>
      )}

      <div className="chat-list" ref={listRef}>
        {messages === null && !error && <p className="small muted">Loading…</p>}
        {messages !== null && shown.length === 0 && (
          <p className="small muted">
            {filter
              ? 'Nothing about this book yet.'
              : 'No messages yet. Share a thought on a book, or how you read this prompt.'}
          </p>
        )}
        {shown.map((m) => {
          const mine = m.user_id === myId;
          const hidden = m.spoiler && !revealed.has(m.id);
          return (
            <div key={m.id} className={`message ${mine ? 'mine' : ''}`}>
              <div className="message-head">
                <strong><PersonLink id={m.user_id} name={m.profiles?.display_name} />{mine && ' (you)'}</strong>
                <span className="small muted">
                  {timeAgo(m.created_at)}
                  {m.edited_at && ' · edited'}
                </span>
                {m.books && (
                  <button className="book-chip" onClick={() => setFilter(m.books!.id)} title="Show messages about this book">
                    {m.books.title}
                  </button>
                )}
                {m.spoiler && <span className="badge">Spoilers</span>}
              </div>
              {hidden ? (
                <button className="spoiler" onClick={() => setRevealed(new Set(revealed).add(m.id))}>
                  <span className="spoiler-text" aria-hidden="true">{m.body}</span>
                  <span className="spoiler-label">Tap to show spoiler</span>
                </button>
              ) : (
                <p className="message-body">{m.body}</p>
              )}
              {(mine || canModerate) && (
                <div className="message-actions small">
                  {mine && <button className="link" onClick={() => startEdit(m)}>Edit</button>}
                  <button className="link danger" onClick={() => remove(m)}>Delete</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form className="chat-composer" onSubmit={send}>
        {editing && <p className="small muted">Editing your message</p>}
        <textarea
          rows={2}
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
          }}
          placeholder="Write a message…"
          aria-label="Message"
        />
        <div className="row chat-options">
          <label className="inline-label small">
            About
            <select value={about} onChange={(e) => setAbout(e.target.value)}>
              <option value="">The prompt in general</option>
              {options.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </label>
          <label className="toggle small">
            <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} />
            Contains spoilers
          </label>
          <span className="grow" />
          {editing && <button type="button" onClick={resetComposer}>Cancel</button>}
          <button className="primary" disabled={!text.trim() || sending}>
            {sending ? 'Sending…' : editing ? 'Save' : 'Send'}
          </button>
        </div>
        {error && <p className="error small">{error}</p>}
      </form>
    </div>
  );
}
