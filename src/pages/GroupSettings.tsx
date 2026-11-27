import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useMe } from '../App';
import type { Challenge, Group, Member } from '../lib/types';

/** Group settings: details (owner and admins), members and roles, and deleting the group (owner). */
export default function GroupSettings() {
  const { groupId } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const data = useAsync(
    () => api<{ group: Group; members: Member[]; challenges: Challenge[] }>(`/api/groups/${groupId}`),
    [groupId],
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [busyMember, setBusyMember] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!data.data) return;
    setName(data.data.group.name);
    setDescription(data.data.group.description ?? '');
  }, [data.data?.group.id]);

  if (data.loading && !data.data) return <p className="muted">Loading…</p>;
  if (data.error || !data.data)
    return (
      <p>
        <span className="error">{data.error}</span> <Link to="/">Go home</Link>
      </p>
    );

  const { group, members, challenges } = data.data;
  const myRole = members.find((m) => m.user_id === me.id)?.role;
  const isOwner = myRole === 'owner';
  const isAdmin = isOwner || myRole === 'admin';

  if (!isAdmin) {
    return (
      <>
        <p className="crumbs"><Link to="/">Groups</Link> / <Link to={`/groups/${groupId}`}>{group.name}</Link> /</p>
        <h1>Group settings</h1>
        <p className="muted">Only the group's owner and admins can change its settings.</p>
      </>
    );
  }

  async function saveDetails(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setDetailsError(null);
    try {
      await api(`/api/groups/${groupId}`, { method: 'PUT', body: { name, description } });
      setSaved(true);
      data.reload();
    } catch (err: any) {
      setDetailsError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function setRole(m: Member, role: 'admin' | 'member') {
    setBusyMember(m.user_id);
    setMemberError(null);
    try {
      await api(`/api/groups/${groupId}/members/${encodeURIComponent(m.user_id)}`, { method: 'PUT', body: { role } });
      await data.reload();
    } catch (err: any) {
      setMemberError(err.message);
    } finally {
      setBusyMember(null);
    }
  }

  async function makeOwner(m: Member) {
    const who = m.profiles?.display_name ?? 'this person';
    if (
      !confirm(
        `Make ${who} the owner of ${group.name}?\n\nYou'll become an admin. Only ${who} will then be able to delete the group, change who's an admin, or hand it on again.`,
      )
    )
      return;
    setBusyMember(m.user_id);
    setMemberError(null);
    try {
      await api(`/api/groups/${groupId}/transfer`, { method: 'POST', body: { userId: m.user_id } });
      await data.reload();
    } catch (err: any) {
      setMemberError(err.message);
    } finally {
      setBusyMember(null);
    }
  }

  async function removeMember(m: Member) {
    const who = m.profiles?.display_name ?? 'this person';
    if (!confirm(`Remove ${who} from ${group.name}? Their logged books stay, and they'll need a new invite to rejoin.`)) return;
    setBusyMember(m.user_id);
    setMemberError(null);
    try {
      await api(`/api/groups/${groupId}/members/${encodeURIComponent(m.user_id)}`, { method: 'DELETE' });
      await data.reload();
    } catch (err: any) {
      setMemberError(err.message);
    } finally {
      setBusyMember(null);
    }
  }

  async function deleteGroup(e: FormEvent) {
    e.preventDefault();
    if (confirmName.trim() !== group.name.trim()) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api(`/api/groups/${groupId}`, { method: 'DELETE' });
      navigate('/');
    } catch (err: any) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  }

  // The owner manages everyone but themself; admins can remove regular members
  const canRemove = (m: Member) => m.user_id !== me.id && m.role !== 'owner' && (isOwner || m.role === 'member');

  return (
    <>
      <p className="crumbs"><Link to="/">Groups</Link> / <Link to={`/groups/${groupId}`}>{group.name}</Link> /</p>
      <h1>Group settings</h1>

      <section className="card">
        <div className="strip">Details</div>
        <form className="form" onSubmit={saveDetails}>
          <label>
            Group name
            <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} required maxLength={100} />
          </label>
          <label>
            Description <span className="muted">(optional)</span>
            <input value={description} onChange={(e) => { setDescription(e.target.value); setSaved(false); }} maxLength={500} />
          </label>
          {detailsError && <p className="error">{detailsError}</p>}
          <div className="row">
            <button className="primary" disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save details'}</button>
            {saved && <span className="small muted">Saved</span>}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="strip red">Members</div>
        <p className="small muted">
          {isOwner
            ? "Admins can edit the group, create invite links, see and manage draft challenges, and remove members. To step back, make someone else the owner; you'll stay on as an admin."
            : 'As an admin you can remove members. Only the owner can change who is an admin.'}
        </p>
        <ul className="member-list manage">
          {members.map((m) => (
            <li key={m.user_id}>
              <span className="grow">
                {m.profiles?.display_name ?? 'Reader'}
                {m.user_id === me.id && ' (you)'}{' '}
                {m.role !== 'member' && <span className="badge">{m.role}</span>}
              </span>
              <span className="row member-actions">
                {isOwner && m.role !== 'owner' && (
                  <button
                    className="small"
                    disabled={busyMember === m.user_id}
                    onClick={() => setRole(m, m.role === 'admin' ? 'member' : 'admin')}
                  >
                    {m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  </button>
                )}
                {isOwner && m.role !== 'owner' && (
                  <button className="small" disabled={busyMember === m.user_id} onClick={() => makeOwner(m)}>
                    Make owner
                  </button>
                )}
                {canRemove(m) && (
                  <button className="link danger small" disabled={busyMember === m.user_id} onClick={() => removeMember(m)}>
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {memberError && <p className="error">{memberError}</p>}
        <p className="small muted">
          To invite people, use <Link to={`/groups/${groupId}`}>Invite people</Link> on the group page.
        </p>
      </section>

      {isOwner && (
        <section className="card danger-zone">
          <div className="strip red">Delete this group</div>
          <p>
            Deleting <strong>{group.name}</strong> removes it for everyone, along with its members list and invite
            links
            {challenges.length > 0 && (
              <>
                , and its {challenges.length === 1 ? 'challenge' : `${challenges.length} challenges`} with everyone's
                logged books and considering lists
              </>
            )}
            . <strong>This can't be undone.</strong>
          </p>
          <p className="small muted">Tags people put on books are kept, since books are shared across groups.</p>
          <form className="form" onSubmit={deleteGroup}>
            <label>
              Type the group's name to confirm: <strong>{group.name}</strong>
              <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
            </label>
            {deleteError && <p className="error">{deleteError}</p>}
            <div>
              <button className="danger-button" disabled={deleting || confirmName.trim() !== group.name.trim()}>
                {deleting ? 'Deleting…' : 'Delete group forever'}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
