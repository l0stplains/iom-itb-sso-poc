import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';

export default function Callback() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // react-oidc-context processes the callback automatically via AuthProvider's
    // onSigninCallback. Once auth.isLoading is false and isAuthenticated is true,
    // navigate to the dashboard.
    if (!auth.isLoading) {
      if (auth.isAuthenticated) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#555' }}>Completing login...</p>
    </div>
  );
}
