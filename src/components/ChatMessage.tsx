import { useState, type ReactNode } from 'react';
import PersonLink from './PersonLink';

export function timeAgo(iso: string) {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} h ago`;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

interface Props {
  userId: string;
  name: string | null | undefined;
  body: string;
  spoiler: boolean;
  createdAt: string;
  edited?: boolean;
  mine?: boolean;
  /** Extra lines under the message, e.g. edit and delete links, or where it was written */
  children?: ReactNode;
}

/** One message in a discussion: who wrote it and when, with spoilers blurred until tapped. */
export default function ChatMessage({ userId, name, body, spoiler, createdAt, edited, mine, children }: Props) {
  const [revealed, setRevealed] = useState(false);
  const hidden = spoiler && !revealed;
  return (
    <div className={`message ${mine ? 'mine' : ''}`}>
      <div className="message-head">
        <strong><PersonLink id={userId} name={name} />{mine && ' (you)'}</strong>
        <span className="small muted">
          {timeAgo(createdAt)}
          {edited && ' · edited'}
        </span>
        {spoiler && <span className="badge">Spoilers</span>}
      </div>
      {hidden ? (
        <button type="button" className="spoiler" onClick={() => setRevealed(true)}>
          <span className="spoiler-text" aria-hidden="true">{body}</span>
          <span className="spoiler-label">Tap to show spoiler</span>
        </button>
      ) : (
        <p className="message-body">{body}</p>
      )}
      {children}
    </div>
  );
}
