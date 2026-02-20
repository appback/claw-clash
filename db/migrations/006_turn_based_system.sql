-- 006: Turn-Based System (v2.5)
-- Adds weapon speed stat, rebalances damage/speed tradeoff, removes heal zone terrain

-- 1. Add speed column to weapons
ALTER TABLE weapons ADD COLUMN IF NOT EXISTS speed SMALLINT DEFAULT 3;

-- 2. Rebalance weapons: speed-damage tradeoff
-- dagger: fastest (speed 5) but lowest damage
UPDATE weapons SET speed = 5, damage = 6, damage_min = 4, damage_max = 7
WHERE slug = 'dagger';

-- sword: balanced speed and damage
UPDATE weapons SET speed = 3, damage = 9, damage_min = 7, damage_max = 11
WHERE slug = 'sword';

-- bow: medium speed, ranged advantage compensates
UPDATE weapons SET speed = 3, damage = 7, damage_min = 5, damage_max = 9
WHERE slug = 'bow';

-- spear: slower but higher damage + lifesteal
UPDATE weapons SET speed = 2, damage = 10, damage_min = 8, damage_max = 13
WHERE slug = 'spear';

-- hammer: slowest but devastating hits + AOE
UPDATE weapons SET speed = 1, damage = 18, damage_min = 14, damage_max = 22
WHERE slug = 'hammer';

-- 3. Update The Pit terrain: remove heal zones (type 4), keep bushes (type 2)
UPDATE arenas SET terrain = '[[0,0,0,0,0,0,0,0],[0,0,2,0,0,2,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,2,0,0,2,0,0],[0,0,0,0,0,0,0,0]]'
WHERE slug = 'the_pit';
