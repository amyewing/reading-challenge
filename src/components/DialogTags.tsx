import { useState } from 'react';
import { useMyBookTags } from '../lib/useMyBookTags';
import TagPicker from './TagPicker';

/** The optional "Tags" section of the log and consider dialogs (closed until opened). */
export default function DialogTags({ myTags }: { myTags: ReturnType<typeof useMyBookTags> }) {
  const [open, setOpen] = useState(false);
  const count = myTags.selected.length;
  if (!open) {
    return (
      <button type="button" className="link small" onClick={() => setOpen(true)}>
        {count ? `Your tags (${count}) · change` : '+ Add tags'} <span className="muted">(optional: genre, mood, pace…)</span>
      </button>
    );
  }
  return (
    <div className="dialog-tags">
      <span className="label-text">
        Tags <span className="muted">(optional, help others find books)</span>
      </span>
      {myTags.loading ? (
        <p className="small muted">Loading…</p>
      ) : (
        <TagPicker selected={myTags.selected} onChange={myTags.setSelected} highlight={myTags.others} />
      )}
    </div>
  );
}

/** Save tags after the main save; a failure here doesn't undo the logged book. */
export async function saveDialogTags(myTags: ReturnType<typeof useMyBookTags>, bookId: string | undefined) {
  if (!bookId) return;
  try {
    await myTags.save(bookId);
  } catch (e: any) {
    alert(`The book was saved, but your tags couldn't be: ${e.message}`);
  }
}
