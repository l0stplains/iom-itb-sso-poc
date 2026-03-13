# SSO Proof of Concept — Keycloak + 2 Frontends + Backend

A working SSO demo using Keycloak as the identity provider. Log in on one frontend and navigate to the other — you are automatically signed in without any password prompt.

## Architecture

```
Browser
  ├── localhost:3001  App Alpha (Blue)  ─┐
  ├── localhost:3002  App Beta  (Green) ─┼──► localhost:4000  Backend API (Express)
  └── localhost:8080  Keycloak          │           │
                                        └───────────┴──► PostgreSQL
                                                          ├── keycloak  (Keycloak's DB)
                                                          └── sso_app   (App's user data)
```

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Ports 3001, 3002, 4000, 8080, 5432 must be free

## Quick Start

```bash
# Clone / navigate to the project
cd iom-itb-sso

# Start everything (first run takes ~2-3 min to pull images + build)
docker compose up --build

# Wait for all services to be healthy, then open:
#   http://localhost:3001  — App Alpha (blue)
#   http://localhost:3002  — App Beta (green)
#   http://localhost:8080  — Keycloak Admin UI
#   http://localhost:4000/api/health  — Backend health check
```

## Test Accounts

| Username   | Password    | Role       |
|------------|-------------|------------|
| testuser   | password123 | app-viewer |
| adminuser  | password123 | app-admin  |

## SSO Test Sequence

1. Open `http://localhost:3001` in your browser
2. Click **Login with Keycloak**
3. Log in with `testuser / password123`
4. You land on App Alpha's dashboard — shows your JWT claims + DB data
5. Click **Switch to App Beta →** (or open `http://localhost:3002` in the same browser)
6. App Beta shows "Checking session..." briefly, then **auto-navigates to dashboard** — no login prompt
7. Both dashboards show the same user, same data — just different colors and titles
8. Click **Logout** on either app → Keycloak session is cleared
9. Visit the other frontend → login button appears (must log in again)

## How Silent SSO Works

When Frontend 2 loads, it calls `auth.signinSilent()` which creates a hidden `<iframe>` pointing to Keycloak's authorization endpoint with `prompt=none`. Keycloak's session cookie lives on `localhost:8080` (Keycloak's domain). The iframe loads from `localhost:8080`, so the browser includes the session cookie. Keycloak sees the valid session and redirects the iframe to `silent-renew.html` with a fresh auth code. The parent window receives this via `postMessage` and exchanges it for tokens — all invisible to the user.

## Backend API

All endpoints require `Authorization: Bearer <access_token>`.

| Method | Path           | Auth | Description                              |
|--------|----------------|------|------------------------------------------|
| GET    | /api/health    | No   | Health check + DB connectivity           |
| GET    | /api/me        | Yes  | Returns JWT claims + app DB data         |

### Example: `/api/me` response

```json
{
  "keycloak": {
    "sub": "abc123...",
    "email": "testuser@example.com",
    "preferred_username": "testuser",
    "roles": ["app-viewer"],
    "exp": 1710000300
  },
  "appData": {
    "id": 1,
    "role": "viewer",
    "notes": null,
    "created_at": "2024-03-10T08:00:00Z",
    "last_seen_at": "2024-03-10T08:05:00Z"
  }
}
```

## Enabling Google Login (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable "Google OAuth API"
3. Create **OAuth 2.0 Client ID** (type: Web application)
4. Add authorized redirect URI: `http://localhost:8080/realms/sso-poc/broker/google/endpoint`
5. Edit `keycloak/realm-export.json`:
   - Set `"enabled": true` in the `identityProviders` array
   - Replace `REPLACE_WITH_GOOGLE_CLIENT_ID` and `REPLACE_WITH_GOOGLE_CLIENT_SECRET`
6. Restart Keycloak: `docker compose restart keycloak`
7. The Keycloak login page will now show a "Google" button

## Extending the Backend Database

The `users` table in `sso_app` is keyed by `keycloak_sub` (the stable Keycloak user UUID). To add more fields:

```sql
-- Connect to the sso_app database
ALTER TABLE users ADD COLUMN department VARCHAR(100);
ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';
```

For a second backend application, create a new database or new tables in `sso_app` — just use the same `keycloak_sub` as the foreign key.

## Project Structure

```
iom-itb-sso/
├── docker-compose.yml         # Orchestrates all 5 services
├── postgres/init.sql          # DB schema (runs once on fresh volume)
├── keycloak/realm-export.json # Realm config: clients, users, roles, Google IDP
├── backend/                   # Node.js + Express API
│   └── src/
│       ├── middleware/verifyToken.js  # JWKS-based JWT verification
│       ├── routes/me.js               # GET /api/me
│       └── db/userSync.js             # Upsert user on login
├── frontend-1/                # React "App Alpha" (blue, port 3001)
└── frontend-2/                # React "App Beta"  (green, port 3002)
```

## Resetting Everything

```bash
# Stop containers and DELETE all data (including Keycloak sessions + DB)
docker compose down -v

# Start fresh
docker compose up --build
```

## Local Development (without Docker)

If you want to run services individually:

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend 1
cd frontend-1 && npm install && npm run dev

# Frontend 2
cd frontend-2 && npm install && npm run dev
```

Make sure Keycloak and PostgreSQL are running (can still use Docker for just those):

```bash
docker compose up postgres keycloak
```
