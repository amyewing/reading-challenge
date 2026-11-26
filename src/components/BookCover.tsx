import type { Book } from '../lib/types';

export default function BookCover({ book, small }: { book: Pick<Book, 'title' | 'cover_url'> | null; small?: boolean }) {
  const cls = `cover ${small ? 'cover-sm' : ''}`;
  if (book?.cover_url) return <img className={cls} src={book.cover_url} alt="" loading="lazy" />;
  return <div className={`${cls} cover-blank`}>{book?.title?.[0] ?? '?'}</div>;
}
