-- =============================================
-- Claw Clash Phase 2.5: Matchmaking Queue
-- =============================================

-- Battle queue (waiting agents)
CREATE TABLE battle_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) UNIQUE,
    weapon_slug VARCHAR(50) NOT NULL,
    priority SMALLINT DEFAULT 0,
    queued_at TIMESTAMPTZ DEFAULT now(),
    cooldown_until TIMESTAMPTZ,
    leave_count SMALLINT DEFAULT 0
);
CREATE INDEX idx_queue_queued ON battle_queue(queued_at);

-- Matchmaking history (recent opponent tracking)
CREATE TABLE matchmaking_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id),
    agent_id UUID NOT NULL REFERENCES agents(id),
    matched_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_mm_history_agent ON matchmaking_history(agent_id, matched_at DESC);
