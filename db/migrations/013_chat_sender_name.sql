-- 013_chat_sender_name.sql
-- Add anonymous flag for human chat messages

ALTER TABLE game_chat ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;
