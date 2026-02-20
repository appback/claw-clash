-- =============================================
-- Claw Clash: Battle Engine v2
-- Weapon diversity, arena terrain, legacy rename
-- =============================================

-- 1. Weapon damage range columns
ALTER TABLE weapons ADD COLUMN damage_min SMALLINT;
ALTER TABLE weapons ADD COLUMN damage_max SMALLINT;

-- Update existing sword
UPDATE weapons SET damage_min = 8, damage_max = 12 WHERE slug = 'sword';

-- 2. New weapons (4 additional)
INSERT INTO weapons (slug, name, category, damage, damage_min, damage_max, range, cooldown, aoe_radius, skill, description) VALUES
('hammer', 'War Hammer', 'melee', 18, 14, 22, 1, 2, 1,
 '{"trigger":"hp_below","threshold":30,"value":1.5}',
 'Massive damage with AOE splash. Slow cooldown. Enrages below 30% HP.'),
('dagger', 'Shadow Dagger', 'melee', 7, 5, 9, 1, 0, 0,
 '{"trigger":"consecutive_hits","threshold":3,"value":2,"effect":"critical"}',
 'Fast and light. Three consecutive hits trigger a devastating critical strike.'),
('bow', 'Longbow', 'ranged', 8, 6, 11, 3, 1, 0,
 NULL,
 'Long range attacks. Misses targets hiding in bushes.'),
('spear', 'Iron Spear', 'melee', 12, 9, 15, 2, 1, 0,
 '{"trigger":"on_hit","effect":"lifesteal","value":0.2}',
 'Medium range melee with 20% lifesteal on every hit.');

-- 3. Arena terrain update: The Pit v2
UPDATE arenas SET terrain = '[[0,0,0,0,0,0,0,0],[0,0,2,0,0,2,0,0],[0,0,0,0,0,0,0,0],[0,0,0,4,4,0,0,0],[0,0,0,4,4,0,0,0],[0,0,0,0,0,0,0,0],[0,0,2,0,0,2,0,0],[0,0,0,0,0,0,0,0]]',
       description = 'Battle arena with central healing zone and bush cover. The ring closes in.'
WHERE slug = 'the_pit';

-- 4. Allow NULL weapon_slug in queue (random assignment)
ALTER TABLE battle_queue ALTER COLUMN weapon_slug DROP NOT NULL;

-- 5. Legacy rename: races_count → battles_count
ALTER TABLE agents RENAME COLUMN races_count TO battles_count;
