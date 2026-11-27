import { useState, type ReactNode } from 'react';

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;
const LONG_TEXT = 280;
const LONG_LINES = 4;

/** Turn the links in one line of text into anchors. Trailing punctuation stays out of the link. */
function linkify(line: string): ReactNode[] {
  return line.split(URL_PATTERN).map((part, i) => {
    if (i % 2 === 0) return part;
    const url = part.replace(/[.,;:!?)\]'"]+$/, '');
    const rest = part.slice(url.length);
    return (
      <span key={i}>
        <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
        {rest}
      </span>
    );
  });
}

interface Props {
  text: string;
  /** Fold long text behind a "Read more" toggle */
  clamp?: boolean;
  className?: string;
}

/**
 * Plain text from a person, shown safely: blank lines make paragraphs, single new lines
 * make line breaks, and web addresses become links. Nothing is ever treated as HTML.
 */
export default function RichText({ text, clamp = false, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const paragraphs = text.trim().split(/\n\s*\n/);
  const long = clamp && (text.length > LONG_TEXT || text.trim().split('\n').length > LONG_LINES);
  const folded = long && !open;

  return (
    <div className={`rich-text ${className}`}>
      <div className={folded ? 'rich-body folded' : 'rich-body'}>
        {paragraphs.map((p, i) => (
          <p key={i}>
            {p.split('\n').map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {linkify(line)}
              </span>
            ))}
          </p>
        ))}
      </div>
      {long && (
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}
