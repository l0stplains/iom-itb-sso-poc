# IOM ITB — SSO Integration Guide

> **Single Sign-On (SSO) implementation using Keycloak, React, and Node.js**
>
> This guide explains the architecture, how to run the PoC, and — most importantly — how to **integrate your own application** into the SSO ecosystem.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Quick Start — Running the PoC](#2-quick-start--running-the-poc)
3. [How SSO Works (The Flow)](#3-how-sso-works-the-flow)
4. [Integrating a New Frontend](#4-integrating-a-new-frontend)
5. [Integrating a New Backend](#5-integrating-a-new-backend)
6. [Keycloak Configuration](#6-keycloak-configuration)
7. [Database Pattern](#7-database-pattern)
8. [Silent SSO (Cross-App Auto-Login)](#8-silent-sso-cross-app-auto-login)
9. [Token Lifecycle & Refresh](#9-token-lifecycle--refresh)
10. [Logout (Single Logout)](#10-logout-single-logout)
11. [Migrating an Existing App to SSO](#11-migrating-an-existing-app-to-sso)
12. [Production Checklist](#12-production-checklist)
13. [Troubleshooting](#13-troubleshooting)
14. [Reference: Project Structure](#14-reference-project-structure)

---

## 1. Architecture Overview

```
                         ┌─────────────────────┐
                         │      Keycloak        │
                         │   (Identity Provider)│
                         │   localhost:8080      │
                         │   Realm: sso-poc      │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
             ┌──────▼──────┐ ┌─────▼──────┐ ┌──────▼──────┐
             │ Frontend 1  │ │ Frontend 2 │ │ Your App    │
             │ (App Alpha) │ │ (App Beta) │ │ (new client)│
             │ :3001       │ │ :3002      │ │ :300X       │
             └──────┬──────┘ └─────┬──────┘ └──────┬──────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                             ┌──────▼──────┐
                             │   Backend   │
                             │ (Express)   │
                             │ :4000       │
                             └──────┬──────┘
                                    │
                             ┌──────▼──────┐
                             │ PostgreSQL  │
                             │ :5435       │
                             └─────────────┘
```

**Key components:**

| Component      | Tech                    | Role                                                  |
| -------------- | ----------------------- | ----------------------------------------------------- |
| **Keycloak**   | Keycloak (latest)       | Identity Provider — manages users, sessions, tokens    |
| **Frontend 1** | React + Vite + nginx    | "App Alpha" — example SPA client (blue theme)          |
| **Frontend 2** | React + Vite + nginx    | "App Beta" — example SPA client (green theme)          |
| **Backend**    | Node.js + Express       | API server — validates JWTs, manages app-specific data |
| **PostgreSQL** | PostgreSQL 16           | Two databases: `keycloak` (internal) + `sso_app` (yours) |

**Key principle:** Keycloak is the **single source of truth** for identity. Your app's database only stores **app-specific data** (roles, preferences, etc.), linked by Keycloak's `sub` (user ID) claim.

---

## 2. Quick Start — Running the PoC

### Prerequisites

- Docker & Docker Compose
- Ports `3001`, `3002`, `4000`, `5435`, `8080` must be free

### Start everything

```bash
docker compose up --build
```

Wait for all services to be healthy (Keycloak takes ~60s on first boot).

### Access

| URL                           | What                     |
| ----------------------------- | ------------------------ |
| `http://localhost:3001`       | Frontend 1 (App Alpha)   |
| `http://localhost:3002`       | Frontend 2 (App Beta)    |
| `http://localhost:4000/api/health` | Backend health check |
| `http://localhost:8080`       | Keycloak admin console   |

### Test credentials

| Username    | Password      | Role        |
| ----------- | ------------- | ----------- |
| `testuser`  | `password123` | `app-viewer` |
| `adminuser` | `password123` | `app-admin`  |

### Keycloak admin

- Username: `admin`
- Password: `admin`

### Test SSO

1. Open `http://localhost:3001` — log in with `testuser / password123`
2. Open `http://localhost:3002` in another tab — you are **automatically logged in** (no password prompt!)
3. Click "Logout" on either app — you are logged out of **both**

---

## 3. How SSO Works (The Flow)

### First login (Frontend 1)

```
User → Frontend 1 → "Login with Keycloak" button
  → Redirected to Keycloak login page (http://localhost:8080/...)
  → User enters credentials
  → Keycloak validates, creates a SESSION COOKIE on :8080
  → Redirects back to Frontend 1 /callback with authorization code
  → Frontend exchanges code for tokens (access + refresh + id token)
  → User sees the Dashboard
```

### SSO magic (Frontend 2, after logging in on Frontend 1)

```
User → Frontend 2 → Home page loads
  → signinSilent() creates a HIDDEN IFRAME
  → Iframe loads Keycloak with prompt=none
  → Keycloak finds the SESSION COOKIE from step 1 (same :8080 domain!)
  → Returns tokens immediately — NO login page shown
  → Frontend 2 receives tokens → Dashboard
```

**Why it works:** All frontends use the same Keycloak realm on the same domain (`localhost:8080`). The browser's session cookie for `:8080` is shared across all apps.

### Token structure

Keycloak issues a JWT access token that looks like:

```json
{
  "sub": "a1b2c3d4-...",          // Unique user ID (use this as foreign key!)
  "preferred_username": "testuser",
  "email": "testuser@example.com",
  "name": "Test User",
  "realm_access": {
    "roles": ["app-viewer"]        // Realm-level roles
  },
  "aud": ["backend-api"],          // Audience — your backend validates this
  "iss": "http://localhost:8080/realms/sso-poc",
  "exp": 1234567890                // Expires in 5 minutes (configurable)
}
```

---

## 4. Integrating a New Frontend

This section walks you through adding a **new React SPA** that participates in the SSO ecosystem.

### Step 1: Register a client in Keycloak

Add a new client to `keycloak/realm-export.json` (or via the admin UI):

```json
{
  "clientId": "my-new-app",
  "name": "My New Application",
  "enabled": true,
  "publicClient": true,
  "standardFlowEnabled": true,
  "implicitFlowEnabled": false,
  "directAccessGrantsEnabled": false,
  "redirectUris": ["http://localhost:3003/*"],
  "webOrigins": ["http://localhost:3003", "+"],
  "rootUrl": "http://localhost:3003",
  "baseUrl": "http://localhost:3003",
  "attributes": {
    "pkce.code.challenge.method": "S256",
    "post.logout.redirect.uris": "http://localhost:3003/"
  },
  "protocolMappers": [
    {
      "name": "backend-api-audience",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-audience-mapper",
      "consentRequired": false,
      "config": {
        "included.client.audience": "backend-api",
        "access.token.claim": "true",
        "id.token.claim": "false"
      }
    }
  ]
}
```

> **Important:** The `protocolMappers` section with `oidc-audience-mapper` adds `"backend-api"` to the token's `aud` claim. Without this, the backend will reject tokens with `jwt audience invalid`.

### Step 2: Install dependencies

```bash
npm install oidc-client-ts react-oidc-context react-router-dom
```

### Step 3: Create OIDC config

```js
// src/oidc-config.js
import { WebStorageStateStore } from 'oidc-client-ts';

const oidcConfig = {
  authority: 'http://localhost:8080/realms/sso-poc',
  client_id: 'my-new-app',                              // Must match Keycloak client ID
  redirect_uri: 'http://localhost:3003/callback',
  post_logout_redirect_uri: 'http://localhost:3003/',
  silent_redirect_uri: 'http://localhost:3003/silent-renew',
  scope: 'openid profile email',
  useRefreshTokens: true,                                // Use refresh tokens (fast) instead of iframe (slow)
  automaticSilentRenew: true,                            // Auto-refresh before token expires
  monitorSession: true,                                  // Detect logout from other apps
  userStore: new WebStorageStateStore({ store: window.localStorage }),
};

export default oidcConfig;
```

### Step 4: Set up the entry point (`main.jsx`)

```jsx
// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import oidcConfig from './oidc-config';

// Handle silent token renewal in a hidden iframe.
// When oidc-client-ts creates an iframe for signinSilent(), Keycloak redirects
// that iframe to /silent-renew. We intercept here using the already-bundled
// oidc-client-ts — no CDN fetch, no extra HTML file needed.
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
          // Remove ?code=...&state=... from the URL after login
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
```

> **Why `/silent-renew` is handled in `main.jsx`:** Using a static HTML file (`public/silent-renew.html`) that loads `oidc-client-ts` from a CDN is fragile — the CDN fetch can take 5-10 seconds or fail entirely. By intercepting the path in `main.jsx`, we use the already-bundled library. Instant, reliable, zero extra files.

### Step 5: Set up routes

```jsx
// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Callback from './pages/Callback';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './pages/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/callback" element={<Callback />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

### Step 6: Core pages

#### Home page (with silent SSO check)

```jsx
// src/pages/Home.jsx
import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Already authenticated? Go to dashboard
    if (auth.isAuthenticated) {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (auth.isLoading) return;

    // Try silent SSO — succeeds if user logged in on another app
    auth.signinSilent()
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => setChecking(false));  // No session — show login button
  }, [auth.isLoading, auth.isAuthenticated]);

  if (auth.isLoading || checking) {
    return <p>Checking session...</p>;
  }

  return (
    <div>
      <h1>My New App</h1>
      <button onClick={() => auth.signinRedirect()}>Login with Keycloak</button>
    </div>
  );
}
```

#### Callback page

```jsx
// src/pages/Callback.jsx
import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';

export default function Callback() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.isLoading) {
      navigate(auth.isAuthenticated ? '/dashboard' : '/', { replace: true });
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  return <p>Completing login...</p>;
}
```

#### Protected route wrapper

```jsx
// src/pages/ProtectedRoute.jsx
import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';

export default function ProtectedRoute({ children }) {
  const auth = useAuth();

  useEffect(() => {
    // Listen for session termination (logout from another app)
    const handleSessionEnd = () => { window.location.href = '/'; };
    auth.events.addUserSignedOut(handleSessionEnd);
    auth.events.addUserUnloaded(handleSessionEnd);
    return () => {
      auth.events.removeUserSignedOut(handleSessionEnd);
      auth.events.removeUserUnloaded(handleSessionEnd);
    };
  }, [auth.events]);

  if (auth.isLoading) return <p>Loading...</p>;
  if (!auth.isAuthenticated) { auth.signinRedirect(); return null; }

  return children;
}
```

#### Dashboard (accessing user data + calling backend)

```jsx
// src/pages/Dashboard.jsx
import { useAuth } from 'react-oidc-context';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const auth = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!auth.user?.access_token) return;

    // Call the backend with the Bearer token
    fetch('http://localhost:4000/api/me', {
      headers: { Authorization: `Bearer ${auth.user.access_token}` },
    })
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, [auth.user?.access_token]);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {auth.user?.profile?.name}</p>
      <p>Email: {auth.user?.profile?.email}</p>
      <p>Roles: {auth.user?.profile?.realm_access?.roles?.join(', ')}</p>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
      <button onClick={() => auth.signoutRedirect()}>Logout</button>
    </div>
  );
}
```

### Step 7: nginx config (for Docker/production)

```nginx
# nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing — all paths serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

### Step 8: Dockerfile

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Step 9: Add to docker-compose.yml

```yaml
  my-new-app:
    build:
      context: ./my-new-app
      dockerfile: Dockerfile
    container_name: sso-my-new-app
    ports:
      - "3003:80"
    networks:
      - sso-net
    depends_on:
      - backend
```

---

## 5. Integrating a New Backend

If you need a **separate backend service** (e.g., a microservice), here's how to validate Keycloak tokens.

### Node.js (Express)

```bash
npm install express cors jsonwebtoken jwks-rsa
```

```js
// Minimal JWT verification middleware
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: 'http://keycloak:8080/realms/sso-poc/protocol/openid-connect/certs',  // Docker internal
  cache: true,
  cacheMaxAge: 600000,  // 10 minutes
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  jwt.verify(token, getKey, {
    issuer: 'http://localhost:8080/realms/sso-poc',    // Must match token's 'iss'
    audience: 'backend-api',                            // Must match token's 'aud'
    algorithms: ['RS256'],
  }, (err, decoded) => {
    if (err) return res.status(401).json({ error: err.message });
    req.user = decoded;
    next();
  });
}
```

### Critical: JWKS URI vs Issuer URL

```
KEYCLOAK_JWKS_URI = http://keycloak:8080/...   ← Docker internal hostname (for fetching keys)
KEYCLOAK_ISSUER   = http://localhost:8080/...   ← Must match the 'iss' claim in the token
```

The browser talks to `localhost:8080`, so the token's `iss` claim is `http://localhost:8080/realms/sso-poc`. But your backend container can't resolve `localhost` to the Keycloak container — it must use the Docker service name `keycloak` for fetching JWKS keys.

**This is the #1 gotcha.** If you see `jwt issuer invalid`, check that your issuer config matches the token exactly.

### Python (FastAPI)

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
import jwt
import httpx

JWKS_URL = "http://keycloak:8080/realms/sso-poc/protocol/openid-connect/certs"
ISSUER = "http://localhost:8080/realms/sso-poc"

async def verify_token(credentials = Depends(HTTPBearer())):
    token = credentials.credentials
    # Fetch JWKS keys
    async with httpx.AsyncClient() as client:
        jwks = (await client.get(JWKS_URL)).json()

    # Decode and validate
    header = jwt.get_unverified_header(token)
    key = next(k for k in jwks["keys"] if k["kid"] == header["kid"])
    payload = jwt.decode(token, key, algorithms=["RS256"],
                         audience="backend-api", issuer=ISSUER)
    return payload
```

### Go

```go
import "github.com/coreos/go-oidc/v3/oidc"

provider, _ := oidc.NewProvider(ctx, "http://keycloak:8080/realms/sso-poc")
verifier := provider.Verifier(&oidc.Config{ClientID: "backend-api"})
token, err := verifier.Verify(ctx, rawToken)
```

---

## 6. Keycloak Configuration

### Realm settings (realm-export.json)

| Setting                     | Value   | Why                                              |
| --------------------------- | ------- | ------------------------------------------------ |
| `sslRequired`               | `none`  | Dev only — set to `external` in production        |
| `ssoSessionIdleTimeout`     | `1800`  | Session expires after 30 min of inactivity        |
| `ssoSessionMaxLifespan`     | `36000` | Max session duration: 10 hours                   |
| `accessTokenLifespan`       | `300`   | Access tokens expire in 5 minutes (refresh cycle) |
| `defaultSignatureAlgorithm` | `RS256` | Standard RSA signing for JWT                     |

### Client types

| Client         | Type             | Purpose                                |
| -------------- | ---------------- | -------------------------------------- |
| `frontend-1`   | Public client    | SPA — cannot keep secrets              |
| `frontend-2`   | Public client    | SPA — cannot keep secrets              |
| `backend-api`  | Bearer-only      | Never initiates login, only validates tokens |

### The audience mapper (critical!)

Each frontend client needs a **protocol mapper** that adds `"backend-api"` to the access token's `aud` (audience) claim:

```json
{
  "name": "backend-api-audience",
  "protocol": "openid-connect",
  "protocolMapper": "oidc-audience-mapper",
  "config": {
    "included.client.audience": "backend-api",
    "access.token.claim": "true",
    "id.token.claim": "false"
  }
}
```

**Without this mapper:** The backend verifies `audience: 'backend-api'`, but the token only has `aud: 'frontend-1'` → 401 Unauthorized.

### Adding via Admin UI (instead of JSON)

1. Go to `http://localhost:8080` → log in as `admin/admin`
2. Select realm **sso-poc**
3. Go to **Clients** → select your client (e.g., `frontend-1`)
4. Go to **Client scopes** tab → click on the dedicated scope (e.g., `frontend-1-dedicated`)
5. Click **Add mapper** → **By configuration** → **Audience**
6. Set:
   - Name: `backend-api-audience`
   - Included Client Audience: `backend-api`
   - Add to access token: ON
   - Add to ID token: OFF

---

## 7. Database Pattern

The `sso_app` database stores **application-specific** data only. User identity comes from Keycloak.

### Schema

```sql
CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  keycloak_sub   VARCHAR(255) UNIQUE NOT NULL,  -- Keycloak user UUID (JWT 'sub' claim)
  email          VARCHAR(255),
  username       VARCHAR(255),
  role           VARCHAR(50) DEFAULT 'viewer',   -- App-level role
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### Upsert pattern (on every authenticated request)

```js
const result = await pool.query(
  `INSERT INTO users (keycloak_sub, email, username, last_seen_at)
   VALUES ($1, $2, $3, NOW())
   ON CONFLICT (keycloak_sub) DO UPDATE
     SET email = EXCLUDED.email, username = EXCLUDED.username, last_seen_at = NOW()
   RETURNING *`,
  [jwtPayload.sub, jwtPayload.email, jwtPayload.name]
);
```

**Why upsert?** The first time a user hits your API, a row is created automatically. On subsequent requests, their info is updated. No separate "registration" step needed — Keycloak handles that.

### Extending for your app

Add columns to the `users` table or create new tables with `keycloak_sub` as a foreign key:

```sql
-- Example: add app preferences
ALTER TABLE users ADD COLUMN theme VARCHAR(20) DEFAULT 'light';
ALTER TABLE users ADD COLUMN language VARCHAR(5) DEFAULT 'en';

-- Example: separate table for app-specific data
CREATE TABLE user_projects (
  id            SERIAL PRIMARY KEY,
  keycloak_sub  VARCHAR(255) REFERENCES users(keycloak_sub),
  project_name  VARCHAR(255),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. Silent SSO (Cross-App Auto-Login)

Silent SSO is what makes "log in once, access all apps" work. Here's how it's implemented:

### How it works

1. **Frontend loads** → calls `auth.signinSilent()`
2. **oidc-client-ts** creates a hidden `<iframe>` pointing to Keycloak with `prompt=none`
3. **Keycloak** checks for its session cookie on `:8080`:
   - **Cookie found** → returns authorization code immediately (no login page)
   - **No cookie** → returns `error=login_required`
4. **Iframe** redirects to `silent_redirect_uri` (`/silent-renew`)
5. **`main.jsx`** intercepts `/silent-renew` and calls `signinSilentCallback()` to send the result back to the parent window

### Implementation in `main.jsx`

```jsx
if (window.location.pathname === '/silent-renew') {
  import('oidc-client-ts').then(({ UserManager }) => {
    new UserManager({}).signinSilentCallback();
  });
}
```

> **Do NOT use a static `public/silent-renew.html`** that loads oidc-client-ts from a CDN. The CDN fetch adds 5-10 seconds of latency on first load and can fail entirely.

### Flow diagram

```
┌──────────────────┐     iframe (hidden)     ┌──────────────┐
│   Your App       │ ──────────────────────→  │   Keycloak   │
│  signinSilent()  │                          │  prompt=none │
│                  │  ←────────────────────── │              │
│                  │   redirect to /silent-   │  checks      │
│                  │   renew?code=...         │  session     │
│                  │                          │  cookie      │
│  signinSilent-   │                          └──────────────┘
│  Callback()      │
│  → tokens!       │
└──────────────────┘
```

---

## 9. Token Lifecycle & Refresh

### Token types

| Token           | Lifetime | Storage        | Purpose                                  |
| --------------- | -------- | -------------- | ---------------------------------------- |
| Access token    | 5 min    | localStorage   | Sent as `Bearer` token to backend APIs   |
| Refresh token   | 30 min   | localStorage   | Used to get new access tokens silently   |
| ID token        | 5 min    | localStorage   | Contains user profile (name, email, etc) |

### Automatic refresh

With `useRefreshTokens: true` and `automaticSilentRenew: true`:

1. oidc-client-ts monitors the access token expiry
2. ~60 seconds before expiry, it sends the refresh token to Keycloak's token endpoint
3. Keycloak returns a new access token + refresh token
4. This is a direct HTTP call — **no iframe, no redirect, instant**

### Why `useRefreshTokens: true` matters

| Method          | Speed   | How                                          |
| --------------- | ------- | -------------------------------------------- |
| Refresh token   | ~100ms  | Direct POST to Keycloak's `/token` endpoint  |
| Iframe (silent) | 1-10s   | Creates iframe, loads page, redirects back   |

Always use refresh tokens. The iframe method is only used as a fallback for the initial silent SSO check (when no refresh token exists yet).

---

## 10. Logout (Single Logout)

### How logout works

```jsx
auth.signoutRedirect();
```

This redirects the user to Keycloak's logout endpoint, which:

1. Terminates the Keycloak session (clears the session cookie)
2. Redirects to `post_logout_redirect_uri` (your app's home page)
3. Other apps detect the session termination via `monitorSession: true`

### Cross-app logout detection

In `ProtectedRoute.jsx`:

```jsx
auth.events.addUserSignedOut(() => {
  window.location.href = '/';  // Redirect to login page
});
```

When `monitorSession: true` is set, oidc-client-ts periodically checks the Keycloak session iframe. When the session is gone, it fires `userSignedOut`, and your app redirects to the home/login page.

---

## 11. Migrating an Existing App to SSO

### Step-by-step migration

#### Phase 1: Keycloak setup

1. Register your app as a new client in Keycloak (see [Section 4, Step 1](#step-1-register-a-client-in-keycloak))
2. Add the audience mapper (so tokens include `backend-api` in `aud`)
3. Import existing users into Keycloak (via admin UI, REST API, or user federation)

#### Phase 2: Frontend migration

1. **Remove** your existing auth logic (login forms, session management, JWT generation)
2. **Install** `oidc-client-ts` and `react-oidc-context`
3. **Wrap** your app in `<AuthProvider>` (see [Section 4, Step 4](#step-4-set-up-the-entry-point-mainjsx))
4. **Replace** session checks with `useAuth()`:

```jsx
// Before (custom auth)
const user = getSession();
if (!user) redirectToLogin();

// After (SSO)
const auth = useAuth();
if (!auth.isAuthenticated) auth.signinRedirect();
```

5. **Replace** API calls to include the Keycloak token:

```jsx
// Before
fetch('/api/data', { headers: { 'X-Session-Id': sessionId } });

// After
fetch('/api/data', {
  headers: { Authorization: `Bearer ${auth.user.access_token}` }
});
```

#### Phase 3: Backend migration

1. **Remove** session/cookie-based auth middleware
2. **Add** JWT verification middleware (see [Section 5](#5-integrating-a-new-backend))
3. **Update** user lookup: use `req.user.sub` (Keycloak UUID) instead of session user ID
4. **Add** the upsert pattern to auto-create user records on first login

#### Phase 4: Database migration

```sql
-- Add keycloak_sub column to your existing users table
ALTER TABLE users ADD COLUMN keycloak_sub VARCHAR(255) UNIQUE;

-- Backfill: map existing users to their Keycloak UUIDs
-- (you'll need to match by email or username)
UPDATE users u
SET keycloak_sub = (
  -- Get this from Keycloak admin API or manual mapping
  'keycloak-uuid-here'
)
WHERE u.email = 'user@example.com';

-- Create index for fast lookups
CREATE INDEX idx_users_keycloak_sub ON users(keycloak_sub);
```

#### Phase 5: Cleanup

1. Remove old auth tables (sessions, password hashes, etc.)
2. Remove login/registration pages (Keycloak handles these now)
3. Update environment variables (add Keycloak URLs, remove old auth secrets)

---

## 12. Production Checklist

### Keycloak

- [ ] Use HTTPS everywhere (`sslRequired: "external"` or `"all"`)
- [ ] Use a proper domain (not `localhost`)
- [ ] Set strong admin credentials
- [ ] Enable brute force protection
- [ ] Configure proper session timeouts
- [ ] Set up database backups for the `keycloak` database
- [ ] Use a dedicated Keycloak version tag (not `latest`)

### Frontend

- [ ] Update all URLs from `localhost` to your domain
- [ ] Set `redirect_uri`, `post_logout_redirect_uri`, `silent_redirect_uri` to real domains
- [ ] Use environment variables for URLs (not hardcoded)
- [ ] Set `X-Frame-Options` to `SAMEORIGIN` in nginx (already done)
- [ ] Enable HTTPS

### Backend

- [ ] Use HTTPS for the JWKS URI
- [ ] Update issuer URL to match production Keycloak
- [ ] Use environment variables for all Keycloak URLs
- [ ] Set proper CORS origins (not `*`)
- [ ] Use a connection pool for PostgreSQL
- [ ] Set proper database credentials (not `sso_app_pass`)

### Security

- [ ] PKCE is enabled (it's automatic with `oidc-client-ts` + authorization code flow)
- [ ] Tokens stored in `localStorage` — acceptable for SPAs, but consider the trade-offs
- [ ] Access tokens have short lifetimes (5 min default)
- [ ] Refresh tokens rotate on use (`revokeRefreshToken` can be enabled)
- [ ] CORS is restricted to known origins
- [ ] CSP headers set appropriately

---

## 13. Troubleshooting

### `jwt audience invalid`

**Cause:** The access token doesn't contain `"backend-api"` in its `aud` claim.

**Fix:** Add the audience mapper to the frontend client in Keycloak (see [Section 6](#the-audience-mapper-critical)).

### `jwt issuer invalid`

**Cause:** The `issuer` in your backend config doesn't match the `iss` claim in the token.

**Fix:** The token's `iss` is `http://localhost:8080/realms/sso-poc` (what the browser sees). Make sure your backend's `KEYCLOAK_ISSUER` matches exactly.

### Silent SSO takes 10+ seconds

**Cause:** The `silent-renew.html` file is loading oidc-client-ts from a CDN, or the callback is never firing.

**Fix:** Use the `main.jsx` approach described in [Section 8](#implementation-in-mainjsx). No static HTML files, no CDN dependency.

### "Checking session..." hangs forever

**Cause:** `signinSilent()` never resolves or rejects.

**Fix:** Make sure the silent renew callback is working. Check that nginx serves `/silent-renew` via `try_files ... /index.html`.

### CORS errors when calling the backend

**Cause:** The backend's CORS config doesn't include your frontend's origin.

**Fix:** Add your frontend URL to `CORS_ORIGINS` in the backend's environment variables:

```yaml
CORS_ORIGINS: http://localhost:3001,http://localhost:3002,http://localhost:3003
```

### Keycloak container fails to start

**Cause:** Usually the PostgreSQL database isn't ready yet.

**Fix:** The `docker-compose.yml` already has `depends_on` with `condition: service_healthy`. Make sure the PostgreSQL healthcheck is passing. On first start, Keycloak can take 60+ seconds to initialize.

### Logout doesn't work on other apps

**Cause:** `monitorSession` is not enabled, or the check session iframe is blocked.

**Fix:** Ensure `monitorSession: true` is in your oidc config, and that `X-Frame-Options` allows Keycloak's check_session_iframe.

---

## 14. Reference: Project Structure

```
iom-itb-sso/
├── docker-compose.yml              # Orchestrates all services
├── iom-itb.png                     # IOM ITB company logo
│
├── keycloak/
│   └── realm-export.json           # Realm config: clients, users, roles, mappers
│
├── postgres/
│   └── init.sql                    # Creates databases, tables, permissions
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js                # Express server setup
│       ├── config.js               # Environment variables
│       ├── db/
│       │   ├── pool.js             # PostgreSQL connection pool
│       │   └── userSync.js         # Upsert user on each request
│       ├── middleware/
│       │   └── verifyToken.js      # JWT verification with JWKS
│       └── routes/
│           ├── health.js           # GET /api/health
│           └── me.js               # GET /api/me (protected)
│
├── frontend-1/                     # App Alpha (Blue theme, port 3001)
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── public/
│   │   └── iom-itb.png            # Company logo (static asset)
│   └── src/
│       ├── main.jsx                # Entry point + silent renew handler
│       ├── App.jsx                 # Route definitions
│       ├── oidc-config.js          # OIDC/Keycloak configuration
│       └── pages/
│           ├── Home.jsx            # Login page with silent SSO check
│           ├── Callback.jsx        # Post-login redirect handler
│           ├── Dashboard.jsx       # Protected dashboard with backend data
│           └── ProtectedRoute.jsx  # Auth guard + session monitoring
│
└── frontend-2/                     # App Beta (Green theme, port 3002)
    └── (same structure as frontend-1, different theme & client_id)
```

---

## Quick Reference: Key URLs & Endpoints

| Endpoint | Description |
|---|---|
| `GET /realms/sso-poc/.well-known/openid-configuration` | OIDC discovery document |
| `GET /realms/sso-poc/protocol/openid-connect/certs` | JWKS public keys (for token verification) |
| `POST /realms/sso-poc/protocol/openid-connect/token` | Token endpoint (exchange code/refresh token) |
| `GET /realms/sso-poc/protocol/openid-connect/auth` | Authorization endpoint (login redirect) |
| `GET /realms/sso-poc/protocol/openid-connect/logout` | Logout endpoint |

All prefixed with `http://localhost:8080` (or your Keycloak base URL).

---

**Questions?** Check the Keycloak docs at [keycloak.org/documentation](https://www.keycloak.org/documentation) or inspect the running realm at `http://localhost:8080/realms/sso-poc/.well-known/openid-configuration`.
