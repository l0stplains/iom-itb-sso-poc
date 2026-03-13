import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import oidcConfig from './oidc-config';

// Handle silent token renewal before mounting React.
// When oidc-client-ts creates a hidden iframe for signinSilent(), Keycloak redirects
// that iframe to /silent-renew. We intercept it here using the already-bundled
// oidc-client-ts — no CDN, no extra HTML file, no type="module" issues.
if (window.location.pathname === '/silent-renew') {
  import('oidc-client-ts').then(({ UserManager }) => {
    new UserManager({}).signinSilentCallback();
  });
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AuthProvider
        {...oidcConfig}
        onSigninCallback={() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        }}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </React.StrictMode>
  );
}
