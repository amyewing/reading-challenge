import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BookTag } from '../lib/types';

interface Props {
  tags: BookTag[];
  max?: number;
  /** Tags to show as selected (e.g. the ones being searched for) */
  active?: string[];
  /** Opens the dialog for adding your own tags */
  onEdit?: () => void;
}

/** A book's tags, most-chosen first. Each links to other books with that tag. */
export default function TagChips({ tags, max = 5, active = [], onEdit }: Props) {
  const [all, setAll] = useState(false);
  if (tags.length === 0 && !onEdit) return null;
  const shown = all ? tags : tags.slice(0, max);
  return (
    <div className="tag-row tag-display">
      {shown.map((t) => (
        <Link
          key={t.id}
          to={`/books?tags=${t.id}`}
          className={`tag-chip small ${active.includes(t.id) ? 'on' : ''} ${t.mine ? 'mine' : ''}`}
          title={`${t.count} ${t.count === 1 ? 'person' : 'people'} tagged it ${t.name}${t.mine ? ' (including you)' : ''}. See other books with this tag.`}
        >
          {t.name}
          {t.count > 1 && <span className="tag-count">{t.count}</span>}
        </Link>
      ))}
      {tags.length > max && (
        <button type="button" className="link small" onClick={() => setAll(!all)}>
          {all ? 'fewer' : `+${tags.length - max}`}
        </button>
      )}
      {onEdit && (
        <button type="button" className="link small" onClick={onEdit}>
          {tags.some((t) => t.mine) ? 'Edit my tags' : 'Add tags'}
        </button>
      )}
    </div>
  );
}
