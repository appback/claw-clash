-- =============================================
-- Claw Clash Phase 2: Battle System
-- =============================================

-- Arenas
CREATE TABLE arenas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    grid_width SMALLINT NOT NULL DEFAULT 8,
    grid_height SMALLINT NOT NULL DEFAULT 8,
    max_players SMALLINT NOT NULL DEFAULT 8,
    terrain JSONB NOT NULL DEFAULT '[]',
    spawn_points JSONB NOT NULL DEFAULT '[]',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Weapons
CREATE TABLE weapons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL DEFAULT 'melee'
        CHECK (category IN ('melee', 'ranged', 'area')),
    damage SMALLINT NOT NULL DEFAULT 10,
    range SMALLINT NOT NULL DEFAULT 1,
    cooldown SMALLINT NOT NULL DEFAULT 0,
    aoe_radius SMALLINT NOT NULL DEFAULT 0,
    skill JSONB,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Games (battle instances)
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    arena_id UUID NOT NULL REFERENCES arenas(id),
    state VARCHAR(20) NOT NULL DEFAULT 'created'
        CHECK (state IN ('created','lobby','betting','battle','ended','archived','cancelled')),
    source VARCHAR(20) DEFAULT 'admin'
        CHECK (source IN ('queue', 'admin', 'private')),
    max_entries SMALLINT NOT NULL DEFAULT 8,
    entry_fee BIGINT DEFAULT 0,
    prize_pool BIGINT DEFAULT 0,
    max_ticks SMALLINT NOT NULL DEFAULT 300,
    lobby_start TIMESTAMPTZ,
    betting_start TIMESTAMPTZ,
    battle_start TIMESTAMPTZ,
    battle_end TIMESTAMPTZ,
    results JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Game entries (participants)
CREATE TABLE game_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id),
    slot SMALLINT NOT NULL,
    weapon_id UUID NOT NULL REFERENCES weapons(id),
    initial_strategy JSONB NOT NULL DEFAULT '{"mode":"balanced","target_priority":"nearest","flee_threshold":20}',
    bonus_hp SMALLINT DEFAULT 0,
    bonus_damage SMALLINT DEFAULT 0,
    entry_fee_paid BIGINT DEFAULT 0,
    final_rank SMALLINT,
    total_score BIGINT DEFAULT 0,
    kills SMALLINT DEFAULT 0,
    damage_dealt BIGINT DEFAULT 0,
    damage_taken BIGINT DEFAULT 0,
    survived_ticks SMALLINT DEFAULT 0,
    prize_earned BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'joined'
        CHECK (status IN ('joined','ready','fighting','eliminated','survived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(game_id, agent_id),
    UNIQUE(game_id, slot)
);

-- Strategy change logs
CREATE TABLE strategy_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id),
    tick SMALLINT NOT NULL,
    strategy JSONB NOT NULL,
    message VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Battle tick snapshots (replay)
CREATE TABLE battle_ticks (
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    tick SMALLINT NOT NULL,
    state JSONB NOT NULL,
    PRIMARY KEY (game_id, tick)
);

-- Game chat
CREATE TABLE game_chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    tick SMALLINT,
    msg_type VARCHAR(20) NOT NULL DEFAULT 'human_chat'
        CHECK (msg_type IN ('ai_strategy','ai_taunt','human_chat','system')),
    sender_id UUID,
    slot SMALLINT,
    message VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Sponsorships
CREATE TABLE sponsorships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    slot SMALLINT NOT NULL,
    boost_type VARCHAR(20) NOT NULL
        CHECK (boost_type IN ('weapon_boost', 'hp_boost')),
    cost BIGINT NOT NULL,
    effect_value SMALLINT NOT NULL,
    payout BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_games_state ON games(state);
CREATE INDEX idx_games_lobby_start ON games(lobby_start) WHERE state = 'created';
CREATE INDEX idx_game_entries_game ON game_entries(game_id);
CREATE INDEX idx_game_entries_agent ON game_entries(agent_id);
CREATE INDEX idx_battle_ticks_game ON battle_ticks(game_id);
CREATE INDEX idx_game_chat_game ON game_chat(game_id, tick);
CREATE INDEX idx_strategy_logs_game ON strategy_logs(game_id, agent_id);
CREATE INDEX idx_sponsorships_game ON sponsorships(game_id, slot);
CREATE INDEX idx_sponsorships_user ON sponsorships(user_id);

-- =============================================
-- Seed Data
-- =============================================

-- MVP Arena: The Pit (8x8 open)
INSERT INTO arenas (slug, name, grid_width, grid_height, max_players, terrain, spawn_points, description) VALUES
('the_pit', 'The Pit', 8, 8, 8,
 '[]',
 '[[0,0],[7,0],[0,7],[7,7],[3,0],[0,3],[7,4],[4,7]]',
 'Open arena with no obstacles. Pure combat skill.');

-- MVP Weapon: Iron Sword
INSERT INTO weapons (slug, name, category, damage, range, cooldown, aoe_radius, description) VALUES
('sword', 'Iron Sword', 'melee', 10, 1, 0, 0, 'Basic melee weapon. Reliable and consistent.');
