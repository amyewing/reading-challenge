import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';
import { api, ApiError, freshTokenGetter, setTokenGetter } from './lib/api';
import type { Me } from './lib/types';
import Home from './pages/Home';
import GroupPage from './pages/GroupPage';
import NewChallenge from './pages/NewChallenge';
import ChallengePage from './pages/ChallengePage';
import EditChallenge from './pages/EditChallenge';
import InvitePage from './pages/InvitePage';
import FindBooks from './pages/FindBooks';
import GroupSettings from './pages/GroupSettings';
import ProfilePage from './pages/ProfilePage';
import Logo from './components/Logo';
import BackToTop from './components/BackToTop';

export const PENDING_INVITE_KEY = 'pendingInvite';

const MeContext = createContext<Me | null>(null);
export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error('useMe must be used inside a signed-in page');
  return me;
}

const RenameMeContext = createContext<(name: string) => void>(() => undefined);
/** Update the name shown for you in the top bar after you change it on your profile */
export function useRenameMe() {
  return useContext(RenameMeContext);
}

/** Works with both v4 (snake_case) and v5 (camelCase) of the Kinde React SDK. */
function readUser(user: any): { id: string; name: string; email: string | null } | null {
  if (!user?.id) return null;
  const first = user.givenName ?? user.given_name ?? '';
  const last = user.familyName ?? user.family_name ?? '';
  const email = user.email ?? null;
  const name = `${first} ${last}`.trim() || (email ? email.split('@')[0] : 'Reader');
  return { id: user.id, name, email };
}

export default function App() {
  const auth = useKindeAuth() as any;
  const { isAuthenticated, isLoading, login, register, logout } = auth;
  const location = useLocation();
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [syncError, setSyncError] = useState<{ message: string; needsSignIn: boolean } | null>(null);

  // Remember invite codes across the sign-in round trip
  const inviteMatch = location.pathname.match(/^\/invite\/([^/]+)/);
  useEffect(() => {
    if (inviteMatch) localStorage.setItem(PENDING_INVITE_KEY, inviteMatch[1]);
  }, [inviteMatch?.[1]]);

  // After sign-in: hook up the token, save the profile, then show the app
  useEffect(() => {
    if (!isAuthenticated) {
      setMe(null);
      return;
    }
    const user = readUser(auth.user);
    if (!user) return;
    setTokenGetter(
      freshTokenGetter(
        () => auth.getAccessToken(),
        () =>
          auth.refreshToken({
            domain: import.meta.env.VITE_KINDE_DOMAIN,
            clientId: import.meta.env.VITE_KINDE_CLIENT_ID,
          }),
      ),
    );

    let cancelled = false;
    (async () => {
      try {
        const saved = await api<{ displayName?: string | null }>('/api/me', {
          method: 'PUT',
          body: { displayName: user.name, email: user.email },
        });
        if (cancelled) return;
        // A name you chose yourself on your profile wins over the one from sign-in
        setMe({ id: user.id, name: saved?.displayName || user.name });
        const pending = localStorage.getItem(PENDING_INVITE_KEY);
        if (pending && !location.pathname.startsWith('/invite/')) navigate(`/invite/${pending}`);
      } catch (e: any) {
        if (!cancelled) setSyncError({ message: e.message, needsSignIn: e instanceof ApiError && e.status === 401 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, auth.user?.id]);

  if (isLoading) return <div className="page narrow muted">Loading…</div>;

  if (!isAuthenticated) {
    return (
      <div className="landing">
        <div className="landing-card">
          <p className="eyebrow">A reading challenge for your people</p>
          <h1>Read more widely, together.</h1>
          <p>
            Create a group for your family or friends, set up a yearly challenge with prompts, and log the
            books you read for each one.
          </p>
          {inviteMatch && <p className="notice">You've been invited to a reading group. Sign in or create an account to join.</p>}
          <div className="row">
            <button className="primary" onClick={() => register()}>Create account</button>
            <button onClick={() => login()}>Sign in</button>
          </div>
        </div>
      </div>
    );
  }

  if (syncError?.needsSignIn) {
    return (
      <div className="page narrow">
        <h1>Please sign in again</h1>
        <p className="muted">Your sign-in has expired or needs refreshing.</p>
        <div className="row">
          <button className="primary" onClick={() => login()}>Sign in again</button>
          <button onClick={() => logout()}>Sign out</button>
        </div>
      </div>
    );
  }

  if (syncError) {
    return (
      <div className="page narrow">
        <h1>Couldn't reach the server</h1>
        <p className="error">{syncError.message}</p>
        <p className="muted">Try reloading the page. If it keeps happening, see README, "Troubleshooting".</p>
        <button onClick={() => logout()}>Sign out</button>
      </div>
    );
  }

  if (!me) return <div className="page narrow muted">Loading…</div>;

  const onMyProfile = location.pathname === '/me' || location.pathname === `/people/${me.id}`;

  return (
    <MeContext.Provider value={me}>
     <RenameMeContext.Provider value={(name) => setMe((m) => (m ? { ...m, name } : m))}>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Reading Challenge, home">
          <Logo />
          <span className="brand-text">Reading Challenge</span>
        </Link>
        <nav className="row" aria-label="Main">
          <NavLink to="/" end className="nav-link">Home</NavLink>
          <NavLink to="/books" className="nav-link">Find books</NavLink>
          <Link
            to="/me"
            className={`nav-link ${onMyProfile ? 'active' : ''}`}
            aria-current={onMyProfile ? 'page' : undefined}
          >
            <span className="wide-only">My profile</span>
            <span className="narrow-only">Profile</span>
          </Link>
          <button className="link" onClick={() => logout()} title={`Signed in as ${me.name}`}>Sign out</button>
        </nav>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/groups/:groupId" element={<GroupPage />} />
          <Route path="/groups/:groupId/challenges/new" element={<NewChallenge />} />
          <Route path="/groups/:groupId/settings" element={<GroupSettings />} />
          <Route path="/challenges/:challengeId" element={<ChallengePage />} />
          <Route path="/challenges/:challengeId/edit" element={<EditChallenge />} />
          <Route path="/invite/:code" element={<InvitePage />} />
          <Route path="/books" element={<FindBooks />} />
          <Route path="/people/:userId" element={<ProfilePage />} />
          <Route path="/me" element={<Navigate to={`/people/${encodeURIComponent(me.id)}`} replace />} />
          <Route path="*" element={<p>Page not found. <Link to="/">Go home</Link></p>} />
        </Routes>
        <BackToTop />
      </main>
     </RenameMeContext.Provider>
    </MeContext.Provider>
  );
}
