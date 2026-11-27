import { Link } from 'react-router-dom';

/** A person's name, linking to their profile */
export default function PersonLink({ id, name }: { id: string; name: string | null | undefined }) {
  return (
    <Link to={`/people/${encodeURIComponent(id)}`} className="person-link">
      {name ?? 'Reader'}
    </Link>
  );
}
