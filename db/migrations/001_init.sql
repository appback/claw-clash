-- Claw Clash: Initial schema (legacy from Claw Race Phase 1)
-- 8 core tables + indexes

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Admin/spectator users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'spectator' CHECK (role IN ('admin', 'spectator')),
    predictor_token TEXT UNIQUE,
    free_predictions_today SMALLINT DEFAULT 0,
    free_predictions_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. AI agents (racers)
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    api_token TEXT UNIQUE NOT NULL,
    owner_id UUID REFERENCES users(id),
    balance_cache BIGINT DEFAULT 0,
    wins INTEGER DEFAULT 0,
    podiums INTEGER DEFAULT 0,
    races_count INTEGER DEFAULT 0,
    total_score BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    meta JSONB DEFAULT '{}',
    external_ids JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Races
CREATE TABLE races (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    track_type VARCHAR(30) DEFAULT 'trivia' CHECK (track_type IN ('trivia', 'estimation', 'word', 'logic', 'creative', 'code')),
    state VARCHAR(20) DEFAULT 'scheduled' CHECK (state IN ('scheduled', 'registration', 'racing', 'scoring', 'finished', 'archived')),
    entry_fee BIGINT DEFAULT 0,
    max_entries SMALLINT DEFAULT 8,
    prize_pool BIGINT DEFAULT 0,
    challenge_count SMALLINT DEFAULT 10,
    registration_start TIMESTAMPTZ,
    race_start TIMESTAMPTZ,
    race_end TIMESTAMPTZ,
    time_limit_per_challenge SMALLINT DEFAULT 60,
    results JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Race entries (agent participation)
CREATE TABLE race_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id),
    entry_fee_paid BIGINT DEFAULT 0,
    total_score BIGINT DEFAULT 0,
    final_rank SMALLINT,
    prize_earned BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'racing', 'finished', 'dnf')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(race_id, agent_id)
);

-- 5. Race challenges (questions per race)
CREATE TABLE race_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    seq SMALLINT NOT NULL,
    challenge_type VARCHAR(30) NOT NULL,
    question JSONB NOT NULL,
    answer JSONB NOT NULL,
    max_score SMALLINT DEFAULT 100,
    time_limit_sec SMALLINT DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(race_id, seq)
);

-- 6. Challenge submissions (agent answers)
CREATE TABLE challenge_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES race_challenges(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id),
    response JSONB NOT NULL,
    score SMALLINT DEFAULT 0,
    scored_at TIMESTAMPTZ,
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(challenge_id, agent_id)
);

-- 7. Predictions (spectator bets)
CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    predictor_token TEXT,
    prediction_type VARCHAR(20) DEFAULT 'win' CHECK (prediction_type IN ('win', 'podium', 'head_to_head')),
    predicted_agent_id UUID NOT NULL REFERENCES agents(id),
    stake BIGINT DEFAULT 0,
    payout BIGINT DEFAULT 0,
    is_correct BOOLEAN,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Question bank (reusable questions)
CREATE TABLE question_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,
    difficulty SMALLINT DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    question JSONB NOT NULL,
    answer JSONB NOT NULL,
    used_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- Indexes
-- ===========================================

CREATE INDEX idx_races_state ON races(state);
CREATE INDEX idx_races_start ON races(race_start DESC);
CREATE INDEX idx_races_registration ON races(registration_start) WHERE state = 'scheduled';
CREATE INDEX idx_entries_race ON race_entries(race_id);
CREATE INDEX idx_entries_agent ON race_entries(agent_id);
CREATE INDEX idx_entries_race_status ON race_entries(race_id, status);
CREATE INDEX idx_submissions_race ON challenge_submissions(race_id, agent_id);
CREATE INDEX idx_submissions_challenge ON challenge_submissions(challenge_id);
CREATE INDEX idx_predictions_race ON predictions(race_id);
CREATE INDEX idx_predictions_user ON predictions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_qbank_category ON question_bank(category, difficulty) WHERE is_active;
CREATE INDEX idx_agents_active ON agents(is_active) WHERE is_active;

-- ===========================================
-- Default admin user (password: admin123)
-- ===========================================
INSERT INTO users (email, password_hash, display_name, role)
VALUES ('admin@clawrace.com', '$2a$10$eRg0AemptWTO0FW..9H5HOVTa35rpM8osslNeYAkjyHWOieVYlDkC', 'Admin', 'admin');
