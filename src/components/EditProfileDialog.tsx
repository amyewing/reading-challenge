import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { Book } from '../lib/types';
import { AVATAR_PRESETS, PresetIcon } from '../lib/avatarPresets';
import Avatar from './Avatar';
import PhotoCropper from './PhotoCropper';
import BookPicker, { bookPayload, isComplete, pickedFromBook, type PickedBook } from './BookPicker';

interface Props {
  person: {
    display_name: string;
    avatar: string | null;
    avatar_preset: string | null;
    featured_book: Book | null;
    featured_note: string | null;
  };
  onClose: () => void;
  /** Called with the saved name, so the rest of the app can show it */
  onSaved: (displayName: string) => void;
}

/** Change your display name and picture, and pick a book to feature with a note on why. */
export default function EditProfileDialog({ person, onClose, onSaved }: Props) {
  const [name, setName] = useState(person.display_name);
  const [avatar, setAvatar] = useState<string | null>(person.avatar);
  const [thumb, setThumb] = useState<string | null>(null); // the small copy used in lists, made when a new photo is chosen
  const [preset, setPreset] = useState<string | null>(person.avatar_preset);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [picked, setPicked] = useState<PickedBook | null>(pickedFromBook(person.featured_book));
  const [choosing, setChoosing] = useState(false); // showing the book search
  const [note, setNote] = useState(person.featured_note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState<File | null>(null); // a chosen photo being framed
  const fileRef = useRef<HTMLInputElement>(null);

  // Escape closes the dialog, or just the photo framing if that is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (cropping ? setCropping(null) : onClose());
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, cropping]);

  function usePhoto(photo: { full: string; thumb: string }) {
    setAvatar(photo.full);
    setThumb(photo.thumb);
    setPreset(null); // a photo replaces any icon
    setAvatarChanged(true);
    setCropping(null);
  }

  const hasBook = isComplete(picked);
  const showPicker = choosing || !!picked;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Please enter a name.');
    if (picked && !hasBook) return setError('Choose a book to feature, or remove it.');
    setSaving(true);
    setError(null);
    try {
      const saved = await api<{ displayName: string }>('/api/me/profile', {
        method: 'PUT',
        body: {
          displayName: name.trim(),
          ...(avatarChanged ? { avatar, avatarThumb: avatar ? thumb : null, avatarPreset: avatar ? null : preset } : {}),
          featuredBook: picked && hasBook ? bookPayload(picked) : null,
          featuredNote: picked && hasBook ? note.trim() || null : null,
        },
      });
      onSaved(saved.displayName);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  // Framing a chosen photo (move and zoom) before it is kept
  if (cropping) {
    return (
      <div className="overlay">
        <div className="dialog">
          <h2>Frame your photo</h2>
          <PhotoCropper file={cropping} onUse={usePhoto} onCancel={() => setCropping(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>Edit your profile</h2>

        <label>
          Display name <span className="muted">(shown to the people in your groups)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
        </label>

        <div>
          <span className="label-text">Profile picture</span>
          <div className="photo-edit">
            <Avatar name={name || 'Reader'} src={avatar} preset={preset} size="lg" />
            <div className="row">
              <input
                ref={fileRef}
                className="file-input"
                type="file"
                accept="image/*"
                aria-label="Choose a profile picture"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setCropping(file);
                  e.target.value = '';
                }}
              />
              <button type="button" onClick={() => fileRef.current?.click()}>
                {avatar ? 'Change photo' : 'Upload a photo'}
              </button>
              {(avatar || preset) && (
                <button
                  type="button"
                  className="link danger"
                  onClick={() => {
                    setAvatar(null);
                    setThumb(null);
                    setPreset(null);
                    setAvatarChanged(true);
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <p className="small muted icon-intro">
            You can move and zoom a photo before it is saved. To change how a saved photo is framed, upload it again.
          </p>
          <p className="small muted icon-intro">Or pick an icon:</p>
          <div className="icon-grid" role="radiogroup" aria-label="Profile icon">
            {AVATAR_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={!avatar && preset === p.key}
                aria-label={p.label}
                title={p.label}
                className="icon-choice"
                onClick={() => {
                  setPreset(p.key);
                  setAvatar(null); // an icon replaces any photo
                  setThumb(null);
                  setAvatarChanged(true);
                }}
              >
                <PresetIcon preset={p} />
              </button>
            ))}
          </div>
        </div>

        <div className="dialog-tags">
          <span className="label-text">Featured book</span>
          <p className="small muted">
            A book you love right now (it doesn’t have to be your favourite), with a few words on why. It shows at the top
            of your profile.
          </p>
          {showPicker ? (
            <>
              <BookPicker value={picked} onChange={setPicked} label="Which book?" />
              <button
                type="button"
                className="link small danger"
                onClick={() => {
                  setPicked(null);
                  setChoosing(false);
                }}
              >
                {hasBook ? 'Remove featured book' : 'Cancel'}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setChoosing(true)}>Choose a book</button>
          )}
          {hasBook && (
            <label>
              Why is it featured? <span className="muted">(optional)</span>
              <textarea
                rows={3}
                value={note}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. I couldn’t put it down, and I keep recommending it"
              />
            </label>
          )}
        </div>

        {error && <p className="error">{error}</p>}
        <div className="row dialog-actions">
          <span className="grow" />
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
