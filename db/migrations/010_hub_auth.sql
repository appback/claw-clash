-- 010_hub_auth.sql
-- Allow Hub-authenticated users (no local password)

-- Hub user ID for cross-service identity
ALTER TABLE users ADD COLUMN IF NOT EXISTS hub_user_id UUID UNIQUE;

-- Allow password_hash to be NULL (Hub-authenticated users have no local password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Allow email to be NULL (Hub users may not have email in CC)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_hub_user_id ON users(hub_user_id);
