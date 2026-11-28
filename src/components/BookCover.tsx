import { useState } from 'react';
import { useMe } from '../App';
import { apiUrl } from '../lib/api';
import type { Book } from '../lib/types';
import CoverDialog from './CoverDialog';

interface Props {
  book: (Pick<Book, 'title' | 'cover_url'> & Partial<Book>) | null;
  small?: boolean;
  /**
   * Pass this to let people fix the cover from here. A book with no cover shows a "+ Cover" tile;
   * a cover you added (or any cover, for a site admin) can be changed or removed. Called after a change.
   */
  onChanged?: () => void;
}

export default function BookCover({ book, small, onChanged }: Props) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const cls = `cover ${small ? 'cover-sm' : ''}`;
  // Covers people uploaded are served by our API ("/api/covers/..."); the rest are Open Library addresses
  const src = book?.cover_url?.startsWith('/api/') ? apiUrl(book.cover_url) : book?.cover_url;
  const image = src ? <img className={cls} src={src} alt="" loading="lazy" /> : null;
  const blank = <div className={`${cls} cover-blank`}>{book?.title?.[0] ?? '?'}</div>;

  // Only books from the catalog (with an id) can have their cover fixed, and only where the page asks for it
  const editable = onChanged && book?.id ? (book as Pick<Book, 'id' | 'title' | 'author' | 'cover_url' | 'open_library_key'>) : null;
  if (!editable) return image ?? blank;

  const missing = !editable.cover_url;
  const mayManage = !missing && (me.isSiteAdmin === true || book?.cover_added_by === me.id);
  const dialog = open && (
    <CoverDialog
      book={editable}
      canRemove={mayManage}
      onClose={() => setOpen(false)}
      onChanged={() => onChanged?.()}
    />
  );

  if (missing) {
    return (
      <>
        <button
          type="button"
          className={`${cls} cover-blank cover-add`}
          onClick={() => setOpen(true)}
          aria-label={`Add a cover for ${editable.title}`}
          title="This book has no cover. Add one."
        >
          {small ? '+' : '+ Cover'}
        </button>
        {dialog}
      </>
    );
  }
  if (mayManage) {
    return (
      <>
        <button
          type="button"
          className="cover-edit"
          onClick={() => setOpen(true)}
          aria-label={`Change the cover of ${editable.title}`}
          title="Change or remove this cover"
        >
          {image}
          <span className="cover-edit-mark" aria-hidden="true">✎</span>
        </button>
        {dialog}
      </>
    );
  }
  return image;
}
