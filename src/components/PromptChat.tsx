import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { Book, PromptMessage } from '../lib/types';
import ChatMessage from './ChatMessage';

interface Props {
  promptId: string;
  /** The book this thread is about; without one it is the prompt's general thread */
  book?: Book | null;
  myId: string;
  /** Organisers and group admins can delete anyone's message */
  canModerate: boolean;
  /** How many messages are new to you, so the page can refresh its counts once they are read */
  unread: number;
  /** Called when counts on the page may be out of date */
  onChanged: () => void;
}

const REFRESH_MS = 20_000;

/**
 * A discussion thread under a prompt: either how to read the prompt (no book), or thoughts on
 * one book. A book's thread is shown under that book.
 */
export default function PromptChat({ promptId, book = null, myId, canModerate, unread, onChanged }: Props) {
  const [messages, setMessages] = useState<PromptMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [editing, setEditing] = useState<PromptMessage | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const firstLoad = useRef(true);
  const url = book ? `/api/prompts/${promptId}/books/${book.id}/messages` : `/api/prompts/${promptId}/messages`;

  const load = useCallback(async () => {
    try {
      const rows = await api<PromptMessage[]>(url);
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
  }, [url]);

  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Keep the newest message in view
  const count = messages?.length ?? 0;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  function startEdit(m: PromptMessage) {
    setEditing(m);
    setText(m.body);
    setSpoiler(m.spoiler);
  }

  function resetComposer() {
    setEditing(null);
    setText('');
    setSpoiler(false);
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const payload = { body, spoiler };
      if (editing) await api(`/api/messages/${editing.id}`, { method: 'PUT', body: payload });
      else await api(url, { method: 'POST', body: payload });
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
      <div className="chat-list" ref={listRef}>
        {messages === null && !error && <p className="small muted">Loading…</p>}
        {messages !== null && messages.length === 0 && (
          <p className="small muted">
            {book ? `Nothing about ${book.title} yet. Be the first to share a thought.` : 'No messages yet. Share how you read this prompt.'}
          </p>
        )}
        {(messages ?? []).map((m) => {
          const mine = m.user_id === myId;
          return (
            <ChatMessage
              key={m.id}
              userId={m.user_id}
              name={m.profiles?.display_name}
              body={m.body}
              spoiler={m.spoiler}
              createdAt={m.created_at}
              edited={!!m.edited_at}
              mine={mine}
            >
              {(mine || canModerate) && (
                <div className="message-actions small">
                  {mine && <button className="link" onClick={() => startEdit(m)}>Edit</button>}
                  <button className="link danger" onClick={() => remove(m)}>Delete</button>
                </div>
              )}
            </ChatMessage>
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
          placeholder={book ? `Write about ${book.title}…` : 'Write a message…'}
          aria-label="Message"
        />
        <div className="row chat-options">
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
