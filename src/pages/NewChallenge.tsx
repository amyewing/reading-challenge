import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import ChallengeEditor, { newPrompt, toPayload } from '../components/ChallengeEditor';

const year = new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear();

export default function NewChallenge() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  return (
    <>
      <p className="crumbs"><Link to={`/groups/${groupId}`}>Back to group</Link></p>
      <h1>New challenge</h1>
      <p className="muted">
        Start with whatever you have. It's saved as a draft you can keep editing, and the group only sees it once
        you launch it.
      </p>
      <ChallengeEditor
        status="draft"
        initial={{
          title: `${year} Reading Challenge`,
          description: '',
          startsOn: `${year}-01-01`,
          endsOn: `${year}-12-31`,
          prompts: [newPrompt(), newPrompt(), newPrompt()],
        }}
        cancelTo={`/groups/${groupId}`}
        submitLabel="Save draft"
        onSave={async (values, launch) => {
          const { id } = await api<{ id: string }>(`/api/groups/${groupId}/challenges`, {
            method: 'POST',
            body: toPayload(values),
          });
          if (launch) await api(`/api/challenges/${id}/launch`, { method: 'POST' });
          navigate(`/challenges/${id}`);
        }}
      />
    </>
  );
}
