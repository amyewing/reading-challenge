import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { KindeProvider } from '@kinde-oss/kinde-auth-react';
import App from './App';
import './styles.css';

const clientId = import.meta.env.VITE_KINDE_CLIENT_ID;
const domain = import.meta.env.VITE_KINDE_DOMAIN;
const audience = import.meta.env.VITE_KINDE_AUDIENCE;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {!clientId || !domain || !audience ? (
      <div className="page narrow">
        <h1>Almost there</h1>
        <p>
          Missing configuration. Copy <code>.env.example</code> to <code>.env.local</code>, fill in your
          values, then restart the app.
        </p>
      </div>
    ) : (
      <KindeProvider
        clientId={clientId}
        domain={domain}
        audience={audience}
        redirectUri={window.location.origin}
        logoutUri={window.location.origin}
        // Without a Kinde custom domain, Kinde can't keep the sign-in in a secure cookie, so a
        // page reload would sign you out. In local development keep it in localStorage instead.
        // In production, set up a Kinde custom domain (see README).
        useInsecureForRefreshToken={import.meta.env.DEV}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </KindeProvider>
    )}
  </React.StrictMode>,
);
