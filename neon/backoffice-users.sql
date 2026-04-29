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

-- Compte backoffice (mot de passe: défini quand la ligne a été insérée; regénérer le hash et UPDATE pour changer)
INSERT INTO backoffice_users (email, password_hash)
SELECT
  'ramzi@gmail.com',
  'pbkdf2$210000$695bc3d7d6d452369488677c066ff0b9$b714d048cb416dbeec779be1a021055b22ec24f03e806b8fa77dfdeec5ebf1e4'
WHERE NOT EXISTS (
  SELECT 1 FROM backoffice_users b WHERE lower(trim(b.email)) = lower(trim('ramzi@gmail.com'))
);
