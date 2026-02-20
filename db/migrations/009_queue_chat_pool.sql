-- 009: Add chat_pool and strategy columns to battle_queue
-- Allows agents to submit chat pool and strategy at queue join time

ALTER TABLE battle_queue ADD COLUMN chat_pool JSONB;
ALTER TABLE battle_queue ADD COLUMN strategy JSONB;
