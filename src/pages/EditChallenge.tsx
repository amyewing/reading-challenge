import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import ChallengeEditor, { newPrompt, toPayload } from '../components/ChallengeEditor';
import type { Challenge, Entry, Prompt } from '../lib/types';

export default function EditChallenge() {
  const { challengeId } = useParams();
  const navigate = useNavigate();
  const data = useAsync(
    () =>
      api<{ challenge: Challenge & { group_name: string }; prompts: Prompt[]; entries: Entry[] }>(
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

  const { challenge, prompts, entries } = data.data;
  if (!challenge.can_manage) {
    return (
      <p>
        Only the person who created this challenge or a group admin can edit it.{' '}
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
    </>
  );
}
