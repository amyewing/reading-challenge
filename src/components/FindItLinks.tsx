import { useEffect, useRef, useState } from 'react';
import { bookLinks } from '../lib/bookLinks';
import type { Book } from '../lib/types';

interface Props {
  book: Pick<Book, 'title' | 'author' | 'open_library_key'>;
  /** pill: a small "Find it" button that opens a list (fits in a row of buttons); inline: the links as a line of text */
  variant?: 'pill' | 'inline';
}

const linkProps = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** Where to find a book: Amazon, Bookshop.org, Goodreads and Open Library. */
export default function FindItLinks({ book, variant = 'pill' }: Props) {
  const links = bookLinks(book);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close the list when you click elsewhere or press Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (variant === 'inline') {
    return (
      <p className="small muted find-it-inline">
        Find it:{' '}
        {links.map((l, i) => (
          <span key={l.label}>
            {i > 0 && ' · '}
            <a href={l.url} {...linkProps}>{l.label}</a>
          </span>
        ))}
      </p>
    );
  }

  return (
    <span className="find-it" ref={ref}>
      <button type="button" className="pill-button" aria-expanded={open} onClick={() => setOpen(!open)}>
        Find it <span aria-hidden="true">↗</span>
      </button>
      {open && (
        <ul className="find-it-list">
          {links.map((l) => (
            <li key={l.label}>
              <a href={l.url} {...linkProps} onClick={() => setOpen(false)}>
                {l.label} <span aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
