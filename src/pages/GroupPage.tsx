import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useMe } from '../App';
import type { Challenge, Group, Member } from '../lib/types';

interface Invite {
  id: string;
  code: string;
  expires_at: string;
}

function formatDate(d: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;
}

export default function GroupPage() {
  const { groupId } = useParams();
  const me = useMe();
  const navigate = useNavigate();

  const data = useAsync(
    () =>
      api<{ group: Group; members: Member[]; challenges: (Challenge & { prompt_count: number; started_count: number })[] }>(
        `/api/groups/${groupId}`,
      ),
    [groupId],
  );

  if (data.loading && !data.data) return <p className="muted">Loading…</p>;
  if (data.error || !data.data)
    return (
      <p>
        <span className="error">{data.error}</span> <Link to="/">Go home</Link>
      </p>
    );

  const { group, members, challenges } = data.data;
  const myRole = members.find((m) => m.user_id === me.id)?.role;
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  async function leaveGroup() {
    if (!confirm(`Leave ${group!.name}? You'll need a new invite to rejoin.`)) return;
    try {
      await api(`/api/groups/${groupId}/membership`, { method: 'DELETE' });
      navigate('/');
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <>
      <p className="crumbs"><Link to="/">Groups</Link> /</p>
      <div className="section-head title-head">
        <h1>{group.name}</h1>
        {isAdmin && <Link className="button" to={`/groups/${groupId}/settings`}>Manage group</Link>}
      </div>
      {group.description && <p className="muted">{group.description}</p>}

      <div className="two-col">
        <section>
          <div className="section-head">
            <h2>Challenges</h2>
            <Link className="button primary" to={`/groups/${groupId}/challenges/new`}>New challenge</Link>
          </div>
          {challenges.length === 0 && <p className="muted">No challenges yet. Create the first one!</p>}
          <div className="cards">
            {challenges.map((c) => (
              <Link key={c.id} to={`/challenges/${c.id}`} className="card card-link">
                <div className={`strip ${c.status === 'draft' ? 'gold' : ''}`}>
                  <span>{c.prompt_count} {c.prompt_count === 1 ? 'prompt' : 'prompts'}</span>
                  {c.status === 'draft' && <span>Draft</span>}
                </div>
                <h3>{c.title}</h3>
                {c.starts_on && (
                  <p className="small muted">{formatDate(c.starts_on)} – {formatDate(c.ends_on) ?? 'open'}</p>
                )}
                {c.description && <p className="muted">{c.description}</p>}
                {c.status === 'active' && (
                  <p className="small muted">
                    {c.started_count === 0 ? 'Nobody has started yet' : `${c.started_count} of ${members.length} started`}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>

        <aside>
          <section className="card">
            <div className="strip red">Members</div>
            <ul className="member-list">
              {members.map((m) => (
                <li key={m.user_id}>
                  <span>{m.profiles?.display_name ?? 'Reader'}{m.user_id === me.id && ' (you)'}</span>
                  {m.role !== 'member' && <span className="badge">{m.role}</span>}
                </li>
              ))}
            </ul>
            {isAdmin && <InvitePanel groupId={groupId!} />}
            {myRole && myRole !== 'owner' && (
              <button className="link danger" onClick={leaveGroup}>Leave group</button>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function InvitePanel({ groupId }: { groupId: string }) {
  const invites = useAsync(() => api<Invite[]>(`/api/groups/${groupId}/invites`), [groupId]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const linkFor = (code: string) => `${window.location.origin}/invite/${code}`;

  async function createInvite() {
    setBusy(true);
    try {
      await api(`/api/groups/${groupId}/invites`, { method: 'POST' });
      await invites.reload();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      await api(`/api/invites/${id}/revoke`, { method: 'POST' });
      invites.reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function copy(code: string) {
    await navigator.clipboard.writeText(linkFor(code));
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="invites">
      <h3>Invite people</h3>
      <p className="small muted">Share a link by text or email. Anyone with the link can join for 14 days.</p>
      {invites.data?.map((inv) => (
        <div key={inv.id} className="invite-row">
          <input readOnly value={linkFor(inv.code)} onFocus={(e) => e.target.select()} />
          <button onClick={() => copy(inv.code)}>{copied === inv.code ? 'Copied!' : 'Copy'}</button>
          <button className="link danger" onClick={() => revoke(inv.id)} title="Stop this link from working">Revoke</button>
        </div>
      ))}
      <button onClick={createInvite} disabled={busy}>{busy ? 'Creating…' : 'Create invite link'}</button>
    </div>
  );
}
