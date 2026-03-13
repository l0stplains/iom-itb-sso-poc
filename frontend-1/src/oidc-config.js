import { WebStorageStateStore } from 'oidc-client-ts';

const oidcConfig = {
  // Keycloak realm URL
  authority: 'http://localhost:8080/realms/sso-poc',
  // This frontend's Keycloak client ID
  client_id: 'frontend-1',
  // Where Keycloak redirects after login (must be in redirectUris in Keycloak)
  redirect_uri: 'http://localhost:3001/callback',
  // Where Keycloak redirects after logout
  post_logout_redirect_uri: 'http://localhost:3001/',
  // Where the silent SSO iframe redirects (must be a STATIC file in /public)
  silent_redirect_uri: 'http://localhost:3001/silent-renew',
  // Scopes requested
  scope: 'openid profile email',
  // Use refresh tokens for silent renewal (fast HTTP call) instead of iframe (slow, ~5-10s).
  // Requires Keycloak to issue refresh tokens, which it does by default with standard flow.
  useRefreshTokens: true,
  // Automatically refresh token before it expires
  automaticSilentRenew: true,
  // Monitor Keycloak session (enables cross-app logout detection)
  monitorSession: true,
  // Store tokens in localStorage so they survive page refresh
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  // PKCE is automatic when using code flow with oidc-client-ts
};

export default oidcConfig;
