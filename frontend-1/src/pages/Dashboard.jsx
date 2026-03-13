import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import AppSwitcher from '../components/AppSwitcher.jsx';

const THEME = {
  primary: '#1a56db',
  light: '#ebf5ff',
  border: '#c3dafe',
  appName: 'App Alpha',
  appNumber: '1',
  port: '3001',
  otherPort: '3002',
  otherName: 'App Beta',
};

const BACKEND_URL = 'http://localhost:4000';

export default function Dashboard() {
  const auth = useAuth();
  const [backendData, setBackendData] = useState(null);
  const [backendError, setBackendError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.user?.access_token) return;

    fetch(`${BACKEND_URL}/api/me`, {
      headers: { Authorization: `Bearer ${auth.user.access_token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => { setBackendData(data); setLoading(false); })
      .catch((err) => { setBackendError(err.message); setLoading(false); });
  }, [auth.user?.access_token]);

  const tokenExpiry = auth.user?.expires_at
    ? new Date(auth.user.expires_at * 1000).toLocaleTimeString()
    : '—';

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={{ ...styles.header, background: THEME.primary }}>
        <div style={styles.headerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src="/iom-itb.png" alt="IOM ITB" style={styles.headerLogo} />
            <div>
              <span style={styles.appTag}>Frontend {THEME.appNumber}</span>
              <h1 style={styles.headerTitle}>{THEME.appName} — Dashboard</h1>
              <p style={styles.headerSub}>localhost:{THEME.port}</p>
            </div>
          </div>
          <div style={styles.headerActions}>
            <a
              href={`http://localhost:${THEME.otherPort}`}
              style={styles.switchLink}
            >
              Switch to {THEME.otherName} →
            </a>
            <button
              style={styles.logoutBtn}
              onClick={() => auth.signoutRedirect()}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {/* JWT Claims Section */}
        <section style={styles.section}>
          <h2 style={{ ...styles.sectionTitle, color: THEME.primary }}>
            Identity (from Keycloak JWT)
          </h2>
          <div style={styles.grid}>
            <Field label="Name" value={auth.user?.profile?.name} />
            <Field label="Email" value={auth.user?.profile?.email} />
            <Field label="Username" value={auth.user?.profile?.preferred_username} />
            <Field label="User ID (sub)" value={auth.user?.profile?.sub} mono />
            <Field label="Roles" value={(auth.user?.profile?.realm_access?.roles ?? []).join(', ') || '—'} />
            <Field label="Token expires" value={tokenExpiry} />
            <Field label="Email verified" value={auth.user?.profile?.email_verified ? 'Yes' : 'No'} />
            <Field label="Issuer" value={auth.user?.profile?.iss} mono small />
          </div>
        </section>

        {/* Backend App Data Section */}
        <section style={styles.section}>
          <h2 style={{ ...styles.sectionTitle, color: THEME.primary }}>
            App Data (from Backend DB)
          </h2>
          {loading && <p style={styles.muted}>Fetching from backend...</p>}
          {backendError && (
            <div style={styles.errorBox}>
              <strong>Backend error:</strong> {backendError}
              <p style={{ fontSize: 12, marginTop: 4 }}>
                Make sure the backend is running on port 4000.
              </p>
            </div>
          )}
          {backendData && (
            <div style={styles.grid}>
              <Field label="App Role" value={backendData.appData?.role} highlight />
              <Field label="Notes" value={backendData.appData?.notes || '(empty)'} />
              <Field label="First seen" value={new Date(backendData.appData?.created_at).toLocaleString()} />
              <Field label="Last seen" value={new Date(backendData.appData?.last_seen_at).toLocaleString()} />
              <Field label="DB Record ID" value={String(backendData.appData?.id)} mono />
            </div>
          )}
        </section>

        {/* Raw Token Section */}
        <section style={styles.section}>
          <h2 style={{ ...styles.sectionTitle, color: THEME.primary }}>Raw Access Token</h2>
          <p style={styles.muted}>
            Copy this and decode at{' '}
            <a href="https://jwt.io" target="_blank" rel="noopener noreferrer" style={{ color: THEME.primary }}>
              jwt.io
            </a>
          </p>
          <textarea
            readOnly
            value={auth.user?.access_token || ''}
            style={styles.tokenArea}
            rows={5}
          />
        </section>
      </main>
      <AppSwitcher userRoles={auth.user?.profile?.realm_access?.roles || []} />
    </div>
  );
}

function Field({ label, value, mono, small, highlight }) {
  return (
    <div style={styles.field}>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={{
        ...styles.fieldValue,
        fontFamily: mono ? 'monospace' : 'inherit',
        fontSize: small ? 11 : mono ? 12 : 14,
        background: highlight ? '#ecfdf5' : 'transparent',
        color: highlight ? '#065f46' : '#1a1a2e',
        padding: highlight ? '2px 8px' : 0,
        borderRadius: highlight ? 4 : 0,
        fontWeight: highlight ? 700 : 400,
      }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f0f4ff' },
  header: { padding: '0 24px', color: 'white' },
  headerInner: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '20px 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLogo: {
    height: 48,
  },
  appTag: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.8,
  },
  headerTitle: { fontSize: 22, fontWeight: 800, margin: '4px 0 2px' },
  headerSub: { fontSize: 13, opacity: 0.7 },
  headerActions: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  switchLink: {
    color: 'white',
    fontSize: 14,
    fontWeight: 500,
    textDecoration: 'none',
    background: 'rgba(255,255,255,0.2)',
    padding: '8px 16px',
    borderRadius: 6,
  },
  logoutBtn: {
    background: 'rgba(255,255,255,0.15)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: 6,
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 14,
  },
  main: { maxWidth: 900, margin: '0 auto', padding: '24px 24px 48px' },
  section: {
    background: 'white',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    boxShadow: '0 2px 8px rgba(26,86,219,0.06)',
  },
  sectionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 },
  field: { padding: '10px 0', borderBottom: '1px solid #f1f5f9' },
  fieldLabel: { fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  fieldValue: { wordBreak: 'break-all' },
  muted: { color: '#888', fontSize: 14, marginBottom: 12 },
  errorBox: { background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8, padding: 12, color: '#c53030', fontSize: 14 },
  tokenArea: {
    width: '100%',
    fontFamily: 'monospace',
    fontSize: 11,
    padding: 12,
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    resize: 'none',
    color: '#555',
    marginTop: 8,
  },
};
