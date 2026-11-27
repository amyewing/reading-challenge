import { useMemo, useState } from 'react';
import { CATEGORIES, createTag, sortTags, useTags } from '../lib/tags';
import type { Tag } from '../lib/types';

interface Props {
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Let people add their own tags (off when the picker is a search filter) */
  allowCreate?: boolean;
  /** Only offer tags that are on at least one book (for search filters) */
  onlyUsed?: boolean;
  /** Tags to offer first, e.g. ones other people put on this book */
  highlight?: { id: string; label: string }[];
}

const PER_CATEGORY = 10;

/** Choose tags from the library, grouped by category, or type to find or add one. */
export default function TagPicker({ selected, onChange, allowCreate = true, onlyUsed = false, highlight = [] }: Props) {
  const { tags, error } = useTags();
  const [query, setQuery] = useState('');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const byId = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags]);
  const chosen = new Set(selected);
  const toggle = (id: string) => onChange(chosen.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (error) return <p className="error small">Couldn't load tags: {error}</p>;
  if (!tags) return <p className="small muted">Loading tags…</p>;

  const available = sortTags(tags.filter((t) => !onlyUsed || t.book_count > 0 || chosen.has(t.id)));
  const trimmed = query.trim().replace(/\s+/g, ' ');
  const matches = trimmed
    ? available.filter((t) => t.name.toLowerCase().includes(trimmed.toLowerCase()))
    : [];
  const exact = tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());

  async function addOwn() {
    setAdding(true);
    setAddError(null);
    try {
      const tag = await createTag(trimmed);
      if (!chosen.has(tag.id)) onChange([...selected, tag.id]);
      setQuery('');
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setAdding(false);
    }
  }

  const chip = (t: Tag, label?: string) => (
    <button
      type="button"
      key={t.id}
      className={`tag-chip ${chosen.has(t.id) ? 'on' : ''}`}
      aria-pressed={chosen.has(t.id)}
      onClick={() => toggle(t.id)}
    >
      {label ?? t.name}
      {onlyUsed && t.book_count > 0 && <span className="tag-count">{t.book_count}</span>}
    </button>
  );

  const offered = highlight.filter((h) => byId.has(h.id) && !chosen.has(h.id));
  const categories = CATEGORIES.map((c) => ({ ...c, tags: available.filter((t) => t.category === c.key) })).filter(
    (c) => c.tags.length > 0,
  );
  const visibleCategories = showAll || onlyUsed ? categories : categories.slice(0, 3);

  return (
    <div className="tag-picker">
      {selected.length > 0 && (
        <div className="tag-row">
          {selected.map((id) => byId.get(id)).filter(Boolean).map((t) => (
            <button type="button" key={t!.id} className="tag-chip on" onClick={() => toggle(t!.id)} aria-label={`Remove ${t!.name}`}>
              {t!.name} <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (exact) {
            if (!chosen.has(exact.id)) toggle(exact.id);
            setQuery('');
          } else if (matches.length === 1) {
            toggle(matches[0].id);
            setQuery('');
          } else if (allowCreate && trimmed) addOwn();
        }}
        placeholder={allowCreate ? 'Find a tag, or type a new one' : 'Find a tag'}
        maxLength={40}
      />

      {trimmed ? (
        <div className="tag-row">
          {matches.slice(0, 30).map((t) => chip(t))}
          {matches.length === 0 && !allowCreate && <span className="small muted">No tags match.</span>}
          {allowCreate && !exact && (
            <button type="button" className="tag-chip add" onClick={addOwn} disabled={adding}>
              {adding ? 'Adding…' : `+ Add “${trimmed}”`}
            </button>
          )}
        </div>
      ) : (
        <>
          {offered.length > 0 && (
            <div className="tag-group">
              <span className="tag-group-label">Others tagged this</span>
              <div className="tag-row">{offered.map((h) => chip(byId.get(h.id)!, h.label))}</div>
            </div>
          )}
          {visibleCategories.map((c) => {
            const open = openCategories[c.key];
            const shown = open ? c.tags : c.tags.slice(0, PER_CATEGORY);
            return (
              <div key={c.key} className="tag-group">
                <span className="tag-group-label">{c.label}</span>
                <div className="tag-row">
                  {shown.map((t) => chip(t))}
                  {c.tags.length > PER_CATEGORY && (
                    <button
                      type="button"
                      className="link small"
                      onClick={() => setOpenCategories({ ...openCategories, [c.key]: !open })}
                    >
                      {open ? 'fewer' : `+${c.tags.length - PER_CATEGORY} more`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {!onlyUsed && categories.length > 3 && (
            <button type="button" className="link small" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Fewer kinds of tags' : 'More kinds of tags: story, themes, format, content notes…'}
            </button>
          )}
          {onlyUsed && categories.length === 0 && <p className="small muted">No books have tags yet.</p>}
        </>
      )}
      {addError && <p className="error small">{addError}</p>}
    </div>
  );
}
