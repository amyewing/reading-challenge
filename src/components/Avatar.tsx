/** A person's profile picture, or their first initial when they haven't added one */
export default function Avatar({ name, src, large = false }: { name: string; src?: string | null; large?: boolean }) {
  const size = large ? 'avatar-lg' : '';
  if (src) return <img className={`avatar ${size}`} src={src} alt={`${name}’s profile picture`} />;
  return (
    <span className={`avatar avatar-blank ${size}`} aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}
