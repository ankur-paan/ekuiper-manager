CREATE TABLE users (
  id text PRIMARY KEY,
  username text NOT NULL,
  username_normalized text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('OWNER', 'USER')),
  must_change_password boolean NOT NULL DEFAULT true,
  disabled_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE managed_nodes (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  base_url text NOT NULL UNIQUE,
  description text,
  authorization_encrypted text,
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (status IN ('UNKNOWN', 'ONLINE', 'OFFLINE', 'INCOMPATIBLE')),
  version text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX managed_nodes_single_default_idx
  ON managed_nodes (is_default)
  WHERE is_default = true;

CREATE TABLE audit_events (
  id text PRIMARY KEY,
  actor_id text REFERENCES users(id) ON DELETE SET NULL,
  node_id text REFERENCES managed_nodes(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  success boolean NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_created_at_idx ON audit_events(created_at DESC);
CREATE INDEX audit_events_actor_id_idx ON audit_events(actor_id);
CREATE INDEX audit_events_node_id_idx ON audit_events(node_id);
