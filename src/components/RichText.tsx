import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;

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
  /** Fold long text behind a "Read more" toggle, showing only the first few lines */
  clamp?: boolean;
  /** How many lines to show while folded */
  lines?: number;
  className?: string;
}

/**
 * Plain text from a person, shown safely: blank lines make paragraphs, single new lines
 * make line breaks, and web addresses become links. Nothing is ever treated as HTML.
 *
 * With `clamp`, text that runs past `lines` lines (as actually laid out, so it depends on the
 * width of the screen) shows just those lines with "Read more"; shorter text shows in full.
 */
export default function RichText({ text, clamp = false, lines = 3, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const paragraphs = text.trim().split(/\n\s*\n/);
  const folded = clamp && !open;

  // While folded, see whether the clipped text is taller than what shows
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || !folded) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [folded, text, lines]);

  const showToggle = clamp && (open || overflows);

  return (
    <div className={`rich-text ${className}`}>
      <div
        ref={bodyRef}
        className={folded ? 'rich-body folded' : 'rich-body'}
        style={folded ? ({ '--lines': lines } as CSSProperties) : undefined}
      >
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
      {showToggle && (
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}
