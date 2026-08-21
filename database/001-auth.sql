-- Account and server-side session storage for the Render PostgreSQL deployment.
-- Browser question-bank data remains in user-scoped localStorage and is not migrated here.

CREATE TABLE IF NOT EXISTS activation_codes (
  id BIGSERIAL PRIMARY KEY,
  code_hash CHAR(64) NOT NULL UNIQUE,
  code_hint VARCHAR(16) NOT NULL,
  label VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_by BIGINT
);

CREATE INDEX IF NOT EXISTS activation_codes_expires_at_idx ON activation_codes(expires_at);
CREATE INDEX IF NOT EXISTS activation_codes_used_at_idx ON activation_codes(used_at);

CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  username_normalized VARCHAR(64) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  activation_code_id BIGINT REFERENCES activation_codes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS activation_code_id BIGINT REFERENCES activation_codes(id);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions(expires_at);
