import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';

// Theme: Blue — App Alpha
const THEME = {
  primary: '#1a56db',
  light: '#ebf5ff',
  appName: 'App Alpha',
  appNumber: '1',
};

export default function Home() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [silentChecking, setSilentChecking] = useState(true);
  const [silentFailed, setSilentFailed] = useState(false);

  useEffect(() => {
    // If already authenticated (e.g. returning from /callback), go to dashboard
    if (auth.isAuthenticated) {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (auth.isLoading) return;

    // Try silent SSO first — this will succeed if the user is already logged in
    // on Keycloak (even if they logged in on a different frontend port).
    // Uses a hidden iframe with prompt=none — no login page is shown.
    auth.signinSilent()
      .then(() => {
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        // No active Keycloak session — user must log in manually
        setSilentChecking(false);
        setSilentFailed(true);
      });
  }, [auth.isLoading, auth.isAuthenticated]);

  if (auth.isLoading || (silentChecking && !silentFailed)) {
    return (
      <div style={styles.center}>
        <div style={{ ...styles.spinner, borderTopColor: THEME.primary }} />
        <p style={{ color: '#555', marginTop: 12 }}>Checking session...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src="/iom-itb.png" alt="IOM ITB" style={styles.logo} />
        <div style={{ ...styles.badge, background: THEME.primary }}>Frontend {THEME.appNumber}</div>
        <h1 style={{ ...styles.title, color: THEME.primary }}>{THEME.appName}</h1>
        <p style={styles.subtitle}>SSO Proof of Concept</p>
        <p style={styles.description}>
          This is <strong>{THEME.appName}</strong> running on <code>localhost:3001</code>.
          If you log in here, you can visit{' '}
          <a href="http://localhost:3002" style={{ color: THEME.primary }}>App Beta (port 3002)</a>{' '}
          and you will be automatically signed in — no password prompt.
        </p>
        <button
          style={{ ...styles.button, background: THEME.primary }}
          onClick={() => auth.signinRedirect()}
        >
          Login with Keycloak
        </button>
        {auth.error && (
          <p style={styles.error}>Error: {auth.error.message}</p>
        )}
        <div style={styles.hint}>
          <p>Test credentials:</p>
          <code>testuser / password123</code><br />
          <code>adminuser / password123</code>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f4ff',
    padding: 24,
  },
  logo: {
    width: 120,
    marginBottom: 20,
  },
  card: {
    background: 'white',
    borderRadius: 12,
    padding: 40,
    maxWidth: 480,
    width: '100%',
    boxShadow: '0 4px 24px rgba(26,86,219,0.1)',
    textAlign: 'center',
  },
  badge: {
    display: 'inline-block',
    color: 'white',
    fontSize: 12,
    fontWeight: 700,
    padding: '4px 12px',
    borderRadius: 20,
    marginBottom: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 32,
    fontWeight: 800,
    marginBottom: 4,
  },
  subtitle: {
    color: '#888',
    marginBottom: 20,
    fontSize: 14,
  },
  description: {
    color: '#444',
    lineHeight: 1.6,
    marginBottom: 28,
    textAlign: 'left',
  },
  button: {
    color: 'white',
    border: 'none',
    borderRadius: 8,
    padding: '12px 32px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    marginBottom: 16,
  },
  hint: {
    background: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    fontSize: 13,
    color: '#555',
    textAlign: 'left',
    marginTop: 8,
  },
  error: {
    color: '#e53e3e',
    fontSize: 13,
    marginBottom: 8,
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #e2e8f0',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
