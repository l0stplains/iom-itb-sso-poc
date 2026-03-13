-- init.sql: runs once on fresh PostgreSQL volume
-- Creates two databases: one for Keycloak, one for the SSO app backend

-- Create Keycloak database
CREATE DATABASE keycloak;

-- Create the SSO app database
CREATE DATABASE sso_app;

-- Create a restricted user for the backend app
CREATE USER sso_app_user WITH PASSWORD 'sso_app_pass';
GRANT ALL PRIVILEGES ON DATABASE sso_app TO sso_app_user;

-- Connect to sso_app and set up schema
\connect sso_app

GRANT ALL ON SCHEMA public TO sso_app_user;

-- Core users table keyed by Keycloak's 'sub' (user ID) claim
-- Future backends create their own tables with keycloak_sub as the foreign key
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  keycloak_sub   VARCHAR(255) UNIQUE NOT NULL,  -- JWT 'sub' claim (Keycloak UUID)
  email          VARCHAR(255),
  username       VARCHAR(255),
  role           VARCHAR(50) DEFAULT 'viewer',   -- app-level role: viewer | admin
  notes          TEXT,                           -- arbitrary admin notes
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup by Keycloak user ID
CREATE INDEX idx_users_keycloak_sub ON users(keycloak_sub);

-- IMPORTANT: In PostgreSQL 15+, GRANT ALL ON SCHEMA only grants CREATE/USAGE,
-- NOT access to existing tables/sequences. Must grant table-level permissions explicitly.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sso_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sso_app_user;

-- Ensure future tables/sequences created in this schema also get permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sso_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sso_app_user;

-- Seed test admin entry (will be matched by keycloak_sub on first real login)
-- This is just a placeholder to show the extensibility pattern
COMMENT ON TABLE users IS 'App-specific user data keyed by Keycloak sub claim. Safe to extend with new columns.';
