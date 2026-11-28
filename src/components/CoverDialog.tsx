import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { cropToCoverJpeg } from '../lib/avatar';
import { coverUrlFor, findCovers } from '../lib/openLibrary';
import type { Book } from '../lib/types';
import PhotoCropper from './PhotoCropper';

interface Props {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover_url' | 'open_library_key'>;
  /** You added this cover, or you are a site admin: you may remove it */
  canRemove: boolean;
  onClose: () => void;
  /** The cover was added, changed or removed, so the page should reload */
  onChanged: () => void;
}

/**
 * Add a cover for a book that has none (or change one you may manage): choose one of the covers
 * Open Library has for it, or upload a picture and frame it.
 */
export default function CoverDialog({ book, canRemove, onClose, onChanged }: Props) {
  const [ids, setIds] = useState<number[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState<File | null>(null); // a chosen picture being framed
  const fileRef = useRef<HTMLInputElement>(null);
  const hasCover = !!book.cover_url;

  useEffect(() => {
    const ctrl = new AbortController();
    findCovers(book, ctrl.signal)
      .then((r) => {
        setIds(r.ids);
        setFailed(r.failed);
      })
      .catch((e) => e.name !== 'AbortError' && setFailed(true));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  // Escape closes the dialog, or just the framing step if that is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && (cropping ? setCropping(null) : onClose());
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, cropping, busy]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
      onClose();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  const choose = (id: number) =>
    run(() => api(`/api/books/${book.id}/cover`, { method: 'PUT', body: { coverUrl: coverUrlFor(id) } }));

  const upload = (image: string) =>
    run(() => api(`/api/books/${book.id}/cover-image`, { method: 'POST', body: { image } }));

  const remove = () => {
    if (!confirm('Take this cover off the book? It will show as missing a cover again, for everyone.')) return;
    return run(() => api(`/api/books/${book.id}/cover`, { method: 'DELETE' }));
  };

  // Framing an uploaded picture (2 wide to 3 tall, like a book cover)
  if (cropping) {
    return (
      <div className="overlay">
        <div className="dialog">
          <h2>Frame the cover</h2>
          <PhotoCropper
            file={cropping}
            aspect={2 / 3}
            round={false}
            encode={cropToCoverJpeg}
            onUse={upload}
            onCancel={() => setCropping(null)}
            busy={busy}
            useLabel="Use this cover"
          />
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">{hasCover ? 'Change the cover of' : 'Add a cover to'}</p>
        <h2>{book.title}</h2>
        {book.author && <p className="muted">{book.author}</p>}
        <p className="small muted">
          Choose the cover that matches your copy. It shows for everyone, in every group. After that, only you (or a site
          admin) can change or remove it.
        </p>

        {ids === null && !failed && <p className="small muted">Looking for covers on Open Library…</p>}
        {failed && <p className="error small">Open Library isn't responding right now. You can still upload a picture.</p>}
        {ids && ids.length === 0 && !failed && (
          <p className="small muted">Open Library doesn't have a cover for this book yet. You can upload a picture.</p>
        )}
        {ids && ids.length > 0 && (
          <div className="cover-grid">
            {ids.map((id) => (
              <button
                key={id}
                type="button"
                className="cover-choice"
                disabled={busy}
                onClick={() => choose(id)}
                aria-label="Use this cover"
              >
                <img src={coverUrlFor(id)} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        <div className="dialog-tags">
          <span className="label-text">Don’t see it? Upload a picture of the cover</span>
          <p className="small muted">
            For example a photo of your own copy. You’ll be able to move and zoom it to frame the cover. Only upload
            pictures you have the right to share.
          </p>
          <input
            ref={fileRef}
            className="file-input"
            type="file"
            accept="image/*"
            aria-label="Choose a picture of the cover"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setCropping(file);
              e.target.value = '';
            }}
          />
          <div>
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>Upload a picture</button>
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        <div className="row dialog-actions">
          {hasCover && canRemove && (
            <button type="button" className="link danger" disabled={busy} onClick={remove}>Remove cover</button>
          )}
          <span className="grow" />
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
