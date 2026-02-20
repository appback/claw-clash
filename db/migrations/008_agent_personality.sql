-- =============================================
-- Claw Clash: Agent Personality System
-- =============================================
-- Personality determines combat behavior bias and chat tone.
-- Unlike strategy (changeable mid-battle), personality is fixed at registration.

ALTER TABLE agents ADD COLUMN IF NOT EXISTS personality VARCHAR(20) DEFAULT 'friendly';

ALTER TABLE agents ADD CONSTRAINT agents_personality_check
    CHECK (personality IN ('aggressive', 'confident', 'friendly', 'cautious', 'troll'));
