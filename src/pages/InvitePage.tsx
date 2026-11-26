import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { PENDING_INVITE_KEY } from '../App';

interface InviteInfo {
  group_id: string;
  group_name: string;
  member_count: number;
  already_member: boolean;
  is_valid: boolean;
}

export default function InvitePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = useAsync(async () => {
    const info = await api<InviteInfo | null>(`/api/invites/by-code/${encodeURIComponent(code!)}`);
    if (!info || !info.is_valid || info.already_member) localStorage.removeItem(PENDING_INVITE_KEY);
    return info;
  }, [code]);

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const { groupId } = await api<{ groupId: string }>(`/api/invites/by-code/${encodeURIComponent(code!)}/accept`, {
        method: 'POST',
      });
      localStorage.removeItem(PENDING_INVITE_KEY);
      navigate(`/groups/${groupId}`);
    } catch (e: any) {
      setError(e.message);
      setJoining(false);
    }
  }

  if (invite.loading) return <p className="muted">Checking your invite…</p>;
  if (invite.error) return <p className="error">{invite.error}</p>;

  const info = invite.data;
  if (!info || !info.is_valid) {
    return (
      <div className="card narrow">
        <h1>This invite has expired</h1>
        <p>Ask the person who invited you for a new link.</p>
        <Link to="/">Go to your groups</Link>
      </div>
    );
  }

  if (info.already_member) {
    return (
      <div className="card narrow">
        <h1>You're already in {info.group_name}</h1>
        <Link className="button primary" to={`/groups/${info.group_id}`}>Open group</Link>
      </div>
    );
  }

  return (
    <div className="card narrow">
      <p className="eyebrow">You're invited</p>
      <h1>Join {info.group_name}</h1>
      <p className="muted">{info.member_count} {info.member_count === 1 ? 'member' : 'members'} reading together.</p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="primary" onClick={join} disabled={joining}>{joining ? 'Joining…' : 'Join group'}</button>
        <button
          onClick={() => {
            localStorage.removeItem(PENDING_INVITE_KEY);
            navigate('/');
          }}
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
