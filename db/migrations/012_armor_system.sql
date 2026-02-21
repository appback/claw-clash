-- 012_armor_system.sql
-- Armor system + dual accumulator turn-based battle engine

-- 1. armors table
CREATE TABLE IF NOT EXISTS armors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('heavy','light','cloth','none')),
  dmg_reduction REAL NOT NULL DEFAULT 0,
  evasion REAL NOT NULL DEFAULT 0,
  move_mod SMALLINT NOT NULL DEFAULT 0,
  atk_mod SMALLINT NOT NULL DEFAULT 0,
  emoji VARCHAR(10) NOT NULL DEFAULT '➖',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Armor seed data
INSERT INTO armors (slug, name, category, dmg_reduction, evasion, move_mod, atk_mod, emoji, description) VALUES
('iron_plate','Iron Plate','heavy', 0.25, 0.0, -10, -10, '🛡️', 'Max defense, reduced speed'),
('leather','Leather Armor','light', 0.10, 0.15, 0, 0, '🦺', 'Balanced defense + evasion'),
('cloth_cape','Cloth Cape','cloth', 0.0, 0.05, 10, 0, '🧣', 'Speed bonus, slight evasion'),
('no_armor','No Armor','none', 0.0, 0.0, 0, 0, '➖', 'No protection')
ON CONFLICT (slug) DO NOTHING;

-- 3. Add dual speed + armor compatibility to weapons
ALTER TABLE weapons ADD COLUMN IF NOT EXISTS move_speed SMALLINT DEFAULT 100;
ALTER TABLE weapons ADD COLUMN IF NOT EXISTS atk_speed SMALLINT DEFAULT 100;
ALTER TABLE weapons ADD COLUMN IF NOT EXISTS allowed_armors TEXT[] DEFAULT ARRAY['heavy','light','cloth','none'];

UPDATE weapons SET move_speed=110, atk_speed=115, allowed_armors=ARRAY['light','cloth','none'] WHERE slug='dagger';
UPDATE weapons SET move_speed=100, atk_speed=100, allowed_armors=ARRAY['heavy','light','cloth','none'] WHERE slug='sword';
UPDATE weapons SET move_speed=100, atk_speed=95,  allowed_armors=ARRAY['light','cloth','none'] WHERE slug='bow';
UPDATE weapons SET move_speed=100, atk_speed=90,  allowed_armors=ARRAY['heavy','light','cloth','none'] WHERE slug='spear';
UPDATE weapons SET move_speed=90,  atk_speed=85,  allowed_armors=ARRAY['heavy','light','cloth','none'] WHERE slug='hammer';

-- 4. game_entries: armor reference
ALTER TABLE game_entries ADD COLUMN IF NOT EXISTS armor_id UUID REFERENCES armors(id);

-- 5. battle_queue: armor slug
ALTER TABLE battle_queue ADD COLUMN IF NOT EXISTS armor_slug VARCHAR(50);

-- 6. Index
CREATE INDEX IF NOT EXISTS idx_armors_active ON armors(is_active) WHERE is_active = true;
