-- OAuth 2.0 tables for MCP server authentication (Phase 5)
-- Run this in the Supabase SQL Editor before deploying the MCP server in SSE mode.
-- These are system-level auth tables — no user_id RLS is needed on them.

-- Pending OAuth requests (before user logs in), expire in 10 min.
-- Created when /authorize is called; consumed when user submits the login form.
CREATE TABLE IF NOT EXISTS oauth_pending_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     text NOT NULL,
  redirect_uri  text NOT NULL,
  code_challenge text NOT NULL,
  state         text,
  scopes        text[] DEFAULT '{}',
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- Issued authorization codes (after login), expire in 5 min, single-use.
-- Created when the user successfully signs in; exchanged for tokens by the client.
CREATE TABLE IF NOT EXISTS oauth_auth_codes (
  code           text PRIMARY KEY,
  client_id      text NOT NULL,
  user_id        uuid REFERENCES auth.users NOT NULL,
  redirect_uri   text NOT NULL,
  code_challenge text NOT NULL,
  scopes         text[] DEFAULT '{}',
  expires_at     timestamptz NOT NULL,
  used           boolean DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

-- Active MCP sessions (access + refresh token hashes).
-- One row per active session; both tokens are rotated on every refresh.
CREATE TABLE IF NOT EXISTS mcp_sessions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid REFERENCES auth.users NOT NULL,
  client_id                text NOT NULL,
  access_token_hash        text UNIQUE NOT NULL,
  refresh_token_hash       text UNIQUE NOT NULL,
  scopes                   text[] DEFAULT '{}',
  access_token_expires_at  timestamptz NOT NULL,
  refresh_token_expires_at timestamptz NOT NULL,
  created_at               timestamptz DEFAULT now()
);

-- Registered OAuth clients (populated by dynamic client registration).
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id          text PRIMARY KEY,
  client_secret_hash text,
  redirect_uris      text[] NOT NULL,
  grant_types        text[] DEFAULT '{"authorization_code","refresh_token"}',
  client_name        text,
  scope              text,
  created_at         timestamptz DEFAULT now()
);

-- Indexes for fast token lookups on every MCP request.
CREATE INDEX IF NOT EXISTS mcp_sessions_access_token_hash_idx  ON mcp_sessions (access_token_hash);
CREATE INDEX IF NOT EXISTS mcp_sessions_refresh_token_hash_idx ON mcp_sessions (refresh_token_hash);
