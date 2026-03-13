import { WebStorageStateStore } from 'oidc-client-ts';

const oidcConfig = {
  authority: 'http://localhost:8080/realms/sso-poc',
  client_id: 'frontend-2',
  redirect_uri: 'http://localhost:3002/callback',
  post_logout_redirect_uri: 'http://localhost:3002/',
  silent_redirect_uri: 'http://localhost:3002/silent-renew',
  scope: 'openid profile email',
  useRefreshTokens: true,
  automaticSilentRenew: true,
  monitorSession: true,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
};

export default oidcConfig;
