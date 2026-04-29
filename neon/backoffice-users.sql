-- Run once in Neon SQL Editor (same database as products).
-- Then insert a user; generate password_hash with: npm run hash:backoffice-password -- "YourSecretPassword"

CREATE TABLE IF NOT EXISTS backoffice_users (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS backoffice_users_email_lower_key
  ON backoffice_users (lower(trim(email)));

COMMENT ON TABLE backoffice_users IS 'Dashboard login; password_hash format pbkdf2$210000$<saltHex>$<hashHex> (see npm run hash:backoffice-password)';

-- Example (replace hash with output of: npm run hash:backoffice-password -- "YourPassword"):
-- INSERT INTO backoffice_users (email, password_hash)
-- VALUES ('admin@example.com', 'pbkdf2$210000$................$................................');
