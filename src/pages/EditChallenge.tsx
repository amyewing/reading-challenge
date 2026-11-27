import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import ChallengeEditor, { newPrompt, toPayload } from '../components/ChallengeEditor';
import type { Challenge, Entry, Member, Prompt } from '../lib/types';

export default function EditChallenge() {
  const { challengeId } = useParams();
  const navigate = useNavigate();
  const data = useAsync(
    () =>
      api<{ challenge: Challenge & { group_name: string }; prompts: Prompt[]; entries: Entry[]; members: Member[] }>(
        `/api/challenges/${challengeId}`,
      ),
    [challengeId],
  );

  if (data.loading && !data.data) return <p className="muted">Loading…</p>;
  if (data.error || !data.data)
    return (
      <p>
        <span className="error">{data.error}</span> <Link to="/">Go home</Link>
      </p>
    );

  const { challenge, prompts, entries, members } = data.data;
  if (!challenge.can_manage) {
    return (
      <p>
        Only the challenge's organiser or a group admin can edit it.{' '}
        <Link to={`/challenges/${challenge.id}`}>Back to the challenge</Link>
      </p>
    );
  }

  const entryCounts: Record<string, number> = {};
  for (const e of entries) entryCounts[e.prompt_id] = (entryCounts[e.prompt_id] ?? 0) + 1;

  return (
    <>
      <p className="crumbs">
        <Link to={`/groups/${challenge.group_id}`}>{challenge.group_name}</Link> /{' '}
        <Link to={`/challenges/${challenge.id}`}>{challenge.title}</Link> /
      </p>
      <h1>
        Edit challenge {challenge.status === 'draft' && <span className="badge">Draft</span>}
      </h1>
      <ChallengeEditor
        status={challenge.status}
        entryCounts={entryCounts}
        initial={{
          title: challenge.title,
          description: challenge.description ?? '',
          startsOn: challenge.starts_on ?? '',
          endsOn: challenge.ends_on ?? '',
          prompts: prompts.map((p) => newPrompt(p.title, p.id, p.description ?? '')),
        }}
        cancelTo={`/challenges/${challenge.id}`}
        submitLabel={challenge.status === 'draft' ? 'Save draft' : 'Save changes'}
        onSave={async (values, launch) => {
          await api(`/api/challenges/${challenge.id}`, { method: 'PUT', body: toPayload(values) });
          if (launch) await api(`/api/challenges/${challenge.id}/launch`, { method: 'POST' });
          navigate(`/challenges/${challenge.id}`);
        }}
      />
      <HandOver
        challenge={challenge}
        members={members}
        onDone={() => navigate(`/challenges/${challenge.id}`)}
      />
    </>
  );
}

/** Make another group member the challenge's organiser. */
function HandOver({ challenge, members, onDone }: { challenge: Challenge; members: Member[]; onDone: () => void }) {
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.profiles?.display_name ?? 'Reader';
  const others = members.filter((m) => m.user_id !== challenge.created_by);
  const organiser = members.some((m) => m.user_id === challenge.created_by) ? nameOf(challenge.created_by) : 'someone who left the group';

  async function handOver() {
    if (!to) return;
    const who = nameOf(to);
    if (
      !confirm(
        `Make ${who} the organiser of "${challenge.title}"?\n\n${who} will be able to edit, launch and delete it. Group admins still can too.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/challenges/${challenge.id}/transfer`, { method: 'POST', body: { userId: to } });
      onDone();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <section className="card hand-over">
      <div className="strip">Organiser</div>
      <p>
        <strong>{organiser}</strong> organises this challenge. To hand it to someone else in the group, choose them
        here. Group admins can always edit it too.
      </p>
      {others.length === 0 ? (
        <p className="small muted">There's no one else in the group to hand it to yet.</p>
      ) : (
        <div className="row">
          <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="New organiser">
            <option value="">Choose someone…</option>
            {others.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profiles?.display_name ?? 'Reader'}
              </option>
            ))}
          </select>
          <button type="button" onClick={handOver} disabled={!to || busy}>
            {busy ? 'Handing over…' : 'Hand over'}
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
