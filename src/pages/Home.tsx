import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  challenge_count: number;
}

export default function Home() {
  const navigate = useNavigate();
  const groups = useAsync(() => api<GroupRow[]>('/api/groups'), []);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createGroup(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>('/api/groups', { method: 'POST', body: { name, description } });
      navigate(`/groups/${id}`);
    } catch (err: any) {
      setError(err.message);
      setCreating(false);
    }
  }

  return (
    <>
      <h1>Your groups</h1>
      {groups.loading && <p className="muted">Loading…</p>}
      {groups.error && <p className="error">{groups.error}</p>}
      {groups.data && groups.data.length === 0 && (
        <p className="muted">You're not in any groups yet. Create one below, or ask someone for an invite link.</p>
      )}
      <div className="cards">
        {groups.data?.map((g) => (
          <Link key={g.id} to={`/groups/${g.id}`} className="card card-link">
            <h3>{g.name}</h3>
            {g.description && <p className="muted">{g.description}</p>}
            <p className="small muted">
              {g.member_count} {g.member_count === 1 ? 'member' : 'members'} ·{' '}
              {g.challenge_count} {g.challenge_count === 1 ? 'challenge' : 'challenges'}
            </p>
          </Link>
        ))}
      </div>

      <section className="card">
        <h2>Create a group</h2>
        <form onSubmit={createGroup} className="form">
          <label>
            Group name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Book Ladies" required maxLength={100} />
          </label>
          <label>
            Description <span className="muted">(optional)</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who's in it, what it's for" />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : 'Create group'}
          </button>
        </form>
      </section>
    </>
  );
}
