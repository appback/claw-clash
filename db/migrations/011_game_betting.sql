-- 011_game_betting.sql
-- User points + game betting system

-- Add points column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS points BIGINT DEFAULT 1000;
UPDATE users SET points = 1000 WHERE points IS NULL;

-- Game bets table
CREATE TABLE IF NOT EXISTS game_bets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id),
    user_id UUID REFERENCES users(id),
    slot SMALLINT NOT NULL,
    amount BIGINT NOT NULL DEFAULT 0 CHECK (amount IN (0, 1, 10, 100)),
    payout BIGINT DEFAULT 0,
    anon_id VARCHAR(64),
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_bets_game ON game_bets(game_id);
CREATE INDEX IF NOT EXISTS idx_game_bets_user ON game_bets(user_id);
