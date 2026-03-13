import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';

export default function ProtectedRoute({ children }) {
  const auth = useAuth();

  useEffect(() => {
    // When Keycloak terminates the session (e.g., logout from another frontend),
    // monitorSession fires userSignedOut → oidc-client-ts calls removeUser → fires userUnloaded.
    // We listen to both to redirect immediately instead of waiting for React re-render cycle.
    const handleSessionEnd = () => {
      window.location.href = '/';
    };
    auth.events.addUserSignedOut(handleSessionEnd);
    auth.events.addUserUnloaded(handleSessionEnd);
    return () => {
      auth.events.removeUserSignedOut(handleSessionEnd);
      auth.events.removeUserUnloaded(handleSessionEnd);
    };
  }, [auth.events]);

  if (auth.isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#555' }}>Loading...</p>
      </div>
    );
  }

  // Check token is still valid — prevents flash of stale dashboard after logout
  const isExpired = auth.user?.expired !== false;
  if (!auth.isAuthenticated || isExpired) {
    auth.signinRedirect();
    return null;
  }

  return children;
}
