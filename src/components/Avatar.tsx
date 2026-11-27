import { findPreset, PresetIcon } from '../lib/avatarPresets';

interface Props {
  name: string;
  /** A photo, as a data URL */
  src?: string | null;
  /** Key of a built-in literary icon, used when there is no photo */
  preset?: string | null;
  /** sm: next to a name in a list; md: profile header; lg: the edit dialog */
  size?: 'sm' | 'md' | 'lg';
}

/** A person's profile picture: their photo, else their chosen icon, else their first initial */
export default function Avatar({ name, src, preset, size = 'md' }: Props) {
  const cls = `avatar avatar-${size}`;
  // Beside a name in a list the picture is decoration; elsewhere it is described
  const decorative = size === 'sm';
  if (src) return <img className={cls} src={src} alt={decorative ? '' : `${name}’s profile picture`} />;
  const icon = findPreset(preset);
  if (icon) {
    return (
      <span
        className={`${cls} avatar-icon`}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : icon.label}
        aria-hidden={decorative ? true : undefined}
      >
        <PresetIcon preset={icon} />
      </span>
    );
  }
  return (
    <span className={`${cls} avatar-blank`} aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}
