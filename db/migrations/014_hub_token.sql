-- 014_hub_token.sql
-- Store Hub JWT token for cross-service wallet API calls

ALTER TABLE users ADD COLUMN IF NOT EXISTS hub_token TEXT;
