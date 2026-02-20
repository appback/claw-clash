-- Claw Clash: Seed question bank (legacy from Claw Race Phase 1) (100 trivia + 20 estimation questions)

-- =============================================
-- TRIVIA: General Knowledge (25 questions)
-- =============================================
INSERT INTO question_bank (category, difficulty, question, answer) VALUES
('general_knowledge', 1, '{"text": "What is the chemical symbol for water?", "type": "short_answer"}', '{"value": "H2O", "accept": ["h2o", "H2O"]}'),
('general_knowledge', 1, '{"text": "How many continents are there on Earth?", "type": "short_answer"}', '{"value": "7", "accept": ["7", "seven"]}'),
('general_knowledge', 1, '{"text": "What is the largest planet in our solar system?", "type": "short_answer"}', '{"value": "Jupiter", "accept": ["jupiter"]}'),
('general_knowledge', 1, '{"text": "What is the capital of France?", "type": "short_answer"}', '{"value": "Paris", "accept": ["paris"]}'),
('general_knowledge', 2, '{"text": "What year did the Titanic sink?", "type": "short_answer"}', '{"value": "1912", "accept": ["1912"]}'),
('general_knowledge', 2, '{"text": "What is the smallest country in the world by area?", "type": "short_answer"}', '{"value": "Vatican City", "accept": ["vatican city", "vatican", "the vatican"]}'),
('general_knowledge', 2, '{"text": "How many bones are in the adult human body?", "type": "short_answer"}', '{"value": "206", "accept": ["206"]}'),
('general_knowledge', 2, '{"text": "What gas do plants absorb from the atmosphere?", "type": "short_answer"}', '{"value": "Carbon dioxide", "accept": ["carbon dioxide", "co2", "CO2"]}'),
('general_knowledge', 3, '{"text": "What is the speed of light in km/s (approximate)?", "type": "short_answer"}', '{"value": "300000", "accept": ["300000", "299792", "3e5"]}'),
('general_knowledge', 3, '{"text": "Who painted the Mona Lisa?", "type": "short_answer"}', '{"value": "Leonardo da Vinci", "accept": ["leonardo da vinci", "da vinci", "leonardo"]}'),
('general_knowledge', 1, '{"text": "What is the boiling point of water in Celsius?", "type": "short_answer"}', '{"value": "100", "accept": ["100", "100c"]}'),
('general_knowledge', 1, '{"text": "What is the currency of Japan?", "type": "short_answer"}', '{"value": "Yen", "accept": ["yen", "japanese yen", "jpy"]}'),
('general_knowledge', 2, '{"text": "What element has the atomic number 1?", "type": "short_answer"}', '{"value": "Hydrogen", "accept": ["hydrogen", "h"]}'),
('general_knowledge', 2, '{"text": "What is the longest river in the world?", "type": "short_answer"}', '{"value": "Nile", "accept": ["nile", "the nile", "nile river"]}'),
('general_knowledge', 3, '{"text": "In what year was the first iPhone released?", "type": "short_answer"}', '{"value": "2007", "accept": ["2007"]}'),
('general_knowledge', 1, '{"text": "What is the hardest natural substance on Earth?", "type": "short_answer"}', '{"value": "Diamond", "accept": ["diamond"]}'),
('general_knowledge', 2, '{"text": "What planet is known as the Red Planet?", "type": "short_answer"}', '{"value": "Mars", "accept": ["mars"]}'),
('general_knowledge', 1, '{"text": "How many days are in a leap year?", "type": "short_answer"}', '{"value": "366", "accept": ["366"]}'),
('general_knowledge', 2, '{"text": "What is the largest ocean on Earth?", "type": "short_answer"}', '{"value": "Pacific", "accept": ["pacific", "pacific ocean", "the pacific"]}'),
('general_knowledge', 3, '{"text": "What is the chemical formula for table salt?", "type": "short_answer"}', '{"value": "NaCl", "accept": ["nacl", "NaCl"]}'),
('general_knowledge', 1, '{"text": "How many legs does a spider have?", "type": "short_answer"}', '{"value": "8", "accept": ["8", "eight"]}'),
('general_knowledge', 2, '{"text": "Who wrote Romeo and Juliet?", "type": "short_answer"}', '{"value": "Shakespeare", "accept": ["shakespeare", "william shakespeare"]}'),
('general_knowledge', 3, '{"text": "What is the most abundant gas in Earth''s atmosphere?", "type": "short_answer"}', '{"value": "Nitrogen", "accept": ["nitrogen", "n2"]}'),
('general_knowledge', 2, '{"text": "What is the capital of Australia?", "type": "short_answer"}', '{"value": "Canberra", "accept": ["canberra"]}'),
('general_knowledge', 3, '{"text": "How many chromosomes do humans have?", "type": "short_answer"}', '{"value": "46", "accept": ["46", "23 pairs"]}');

-- =============================================
-- TRIVIA: Science (25 questions)
-- =============================================
INSERT INTO question_bank (category, difficulty, question, answer) VALUES
('science', 1, '{"text": "What force keeps us on the ground?", "type": "short_answer"}', '{"value": "Gravity", "accept": ["gravity", "gravitational force"]}'),
('science', 2, '{"text": "What is the powerhouse of the cell?", "type": "short_answer"}', '{"value": "Mitochondria", "accept": ["mitochondria", "mitochondrion"]}'),
('science', 2, '{"text": "What is the chemical symbol for gold?", "type": "short_answer"}', '{"value": "Au", "accept": ["au", "Au"]}'),
('science', 3, '{"text": "What is the half-life of Carbon-14 in years (approximate)?", "type": "short_answer"}', '{"value": "5730", "accept": ["5730", "5700"]}'),
('science', 1, '{"text": "What planet is closest to the Sun?", "type": "short_answer"}', '{"value": "Mercury", "accept": ["mercury"]}'),
('science', 2, '{"text": "What is the pH of pure water?", "type": "short_answer"}', '{"value": "7", "accept": ["7", "seven"]}'),
('science', 3, '{"text": "What is the most abundant element in the universe?", "type": "short_answer"}', '{"value": "Hydrogen", "accept": ["hydrogen", "h"]}'),
('science', 1, '{"text": "How many teeth does an adult human typically have?", "type": "short_answer"}', '{"value": "32", "accept": ["32"]}'),
('science', 2, '{"text": "What type of rock is formed by cooling magma?", "type": "short_answer"}', '{"value": "Igneous", "accept": ["igneous", "igneous rock"]}'),
('science', 3, '{"text": "What is the speed of sound in air at sea level (m/s, approximate)?", "type": "short_answer"}', '{"value": "343", "accept": ["343", "340", "330"]}'),
('science', 1, '{"text": "What is the largest organ in the human body?", "type": "short_answer"}', '{"value": "Skin", "accept": ["skin", "the skin"]}'),
('science', 2, '{"text": "What vitamin does the body produce when exposed to sunlight?", "type": "short_answer"}', '{"value": "Vitamin D", "accept": ["vitamin d", "d", "vit d"]}'),
('science', 2, '{"text": "What gas do humans exhale?", "type": "short_answer"}', '{"value": "Carbon dioxide", "accept": ["carbon dioxide", "co2"]}'),
('science', 3, '{"text": "What is the Avogadro constant (approximate, x10^23)?", "type": "short_answer"}', '{"value": "6.022", "accept": ["6.022", "6.02", "6"]}'),
('science', 1, '{"text": "What is the freezing point of water in Fahrenheit?", "type": "short_answer"}', '{"value": "32", "accept": ["32", "32f"]}'),
('science', 2, '{"text": "What is the study of earthquakes called?", "type": "short_answer"}', '{"value": "Seismology", "accept": ["seismology"]}'),
('science', 3, '{"text": "What is the charge of a proton?", "type": "short_answer"}', '{"value": "Positive", "accept": ["positive", "+1", "1+"]}'),
('science', 1, '{"text": "What is the closest star to Earth?", "type": "short_answer"}', '{"value": "The Sun", "accept": ["the sun", "sun", "sol"]}'),
('science', 2, '{"text": "What blood type is the universal donor?", "type": "short_answer"}', '{"value": "O negative", "accept": ["o negative", "o-", "o neg"]}'),
('science', 3, '{"text": "What is the chemical symbol for iron?", "type": "short_answer"}', '{"value": "Fe", "accept": ["fe", "Fe"]}'),
('science', 1, '{"text": "How many planets are in our solar system?", "type": "short_answer"}', '{"value": "8", "accept": ["8", "eight"]}'),
('science', 2, '{"text": "What is the main component of the Sun?", "type": "short_answer"}', '{"value": "Hydrogen", "accept": ["hydrogen", "h"]}'),
('science', 3, '{"text": "What particle has no electric charge?", "type": "short_answer"}', '{"value": "Neutron", "accept": ["neutron"]}'),
('science', 2, '{"text": "What is the process by which plants make food?", "type": "short_answer"}', '{"value": "Photosynthesis", "accept": ["photosynthesis"]}'),
('science', 1, '{"text": "What is the chemical formula for oxygen gas?", "type": "short_answer"}', '{"value": "O2", "accept": ["o2", "O2"]}');

-- =============================================
-- TRIVIA: History (25 questions)
-- =============================================
INSERT INTO question_bank (category, difficulty, question, answer) VALUES
('history', 1, '{"text": "In which year did World War II end?", "type": "short_answer"}', '{"value": "1945", "accept": ["1945"]}'),
('history', 2, '{"text": "Who was the first person to walk on the Moon?", "type": "short_answer"}', '{"value": "Neil Armstrong", "accept": ["neil armstrong", "armstrong"]}'),
('history', 2, '{"text": "What ancient wonder was located in Alexandria, Egypt?", "type": "short_answer"}', '{"value": "Lighthouse", "accept": ["lighthouse", "lighthouse of alexandria", "pharos"]}'),
('history', 3, '{"text": "In what year did the Berlin Wall fall?", "type": "short_answer"}', '{"value": "1989", "accept": ["1989"]}'),
('history', 1, '{"text": "Who discovered America in 1492?", "type": "short_answer"}', '{"value": "Columbus", "accept": ["columbus", "christopher columbus"]}'),
('history', 2, '{"text": "What empire was ruled by Julius Caesar?", "type": "short_answer"}', '{"value": "Roman Empire", "accept": ["roman empire", "roman", "rome"]}'),
('history', 3, '{"text": "In what year did the French Revolution begin?", "type": "short_answer"}', '{"value": "1789", "accept": ["1789"]}'),
('history', 1, '{"text": "Who was the first President of the United States?", "type": "short_answer"}', '{"value": "George Washington", "accept": ["george washington", "washington"]}'),
('history', 2, '{"text": "What year did World War I begin?", "type": "short_answer"}', '{"value": "1914", "accept": ["1914"]}'),
('history', 3, '{"text": "Who invented the printing press?", "type": "short_answer"}', '{"value": "Gutenberg", "accept": ["gutenberg", "johannes gutenberg", "johann gutenberg"]}'),
('history', 1, '{"text": "What ship sank in 1912 after hitting an iceberg?", "type": "short_answer"}', '{"value": "Titanic", "accept": ["titanic", "rms titanic", "the titanic"]}'),
('history', 2, '{"text": "What country gifted the Statue of Liberty to the USA?", "type": "short_answer"}', '{"value": "France", "accept": ["france"]}'),
('history', 3, '{"text": "In what year was the Magna Carta signed?", "type": "short_answer"}', '{"value": "1215", "accept": ["1215"]}'),
('history', 1, '{"text": "What wall was built to protect China from invaders?", "type": "short_answer"}', '{"value": "Great Wall of China", "accept": ["great wall of china", "great wall", "the great wall"]}'),
('history', 2, '{"text": "Who was the British monarch during World War II?", "type": "short_answer"}', '{"value": "George VI", "accept": ["george vi", "king george vi", "george 6"]}'),
('history', 3, '{"text": "What was the last dynasty of China?", "type": "short_answer"}', '{"value": "Qing", "accept": ["qing", "qing dynasty", "manchu"]}'),
('history', 1, '{"text": "What ancient civilization built the pyramids?", "type": "short_answer"}', '{"value": "Egyptian", "accept": ["egyptian", "egyptians", "ancient egypt", "egypt"]}'),
('history', 2, '{"text": "Who led India to independence through nonviolent civil disobedience?", "type": "short_answer"}', '{"value": "Gandhi", "accept": ["gandhi", "mahatma gandhi", "mohandas gandhi"]}'),
('history', 3, '{"text": "What treaty ended World War I?", "type": "short_answer"}', '{"value": "Treaty of Versailles", "accept": ["treaty of versailles", "versailles"]}'),
('history', 1, '{"text": "Which country was the first to land on the Moon?", "type": "short_answer"}', '{"value": "United States", "accept": ["united states", "usa", "us", "america"]}'),
('history', 2, '{"text": "What was the name of the first satellite launched into space?", "type": "short_answer"}', '{"value": "Sputnik", "accept": ["sputnik", "sputnik 1"]}'),
('history', 3, '{"text": "What year was the United Nations founded?", "type": "short_answer"}', '{"value": "1945", "accept": ["1945"]}'),
('history', 2, '{"text": "Which explorer first circumnavigated the globe?", "type": "short_answer"}', '{"value": "Magellan", "accept": ["magellan", "ferdinand magellan"]}'),
('history', 1, '{"text": "What was the Cold War between?", "type": "short_answer"}', '{"value": "USA and USSR", "accept": ["usa and ussr", "us and soviet union", "america and russia", "united states and soviet union"]}'),
('history', 3, '{"text": "In what year did the Roman Empire officially fall?", "type": "short_answer"}', '{"value": "476", "accept": ["476", "476 ad"]}');

-- =============================================
-- TRIVIA: Geography (15 questions)
-- =============================================
INSERT INTO question_bank (category, difficulty, question, answer) VALUES
('geography', 1, '{"text": "What is the largest desert in the world?", "type": "short_answer"}', '{"value": "Sahara", "accept": ["sahara", "sahara desert", "the sahara"]}'),
('geography', 2, '{"text": "What is the tallest mountain in the world?", "type": "short_answer"}', '{"value": "Mount Everest", "accept": ["mount everest", "everest", "mt everest"]}'),
('geography', 1, '{"text": "What is the smallest continent?", "type": "short_answer"}', '{"value": "Australia", "accept": ["australia", "oceania"]}'),
('geography', 2, '{"text": "What country has the largest population?", "type": "short_answer"}', '{"value": "India", "accept": ["india", "china"]}'),
('geography', 3, '{"text": "What is the deepest point in the ocean?", "type": "short_answer"}', '{"value": "Mariana Trench", "accept": ["mariana trench", "challenger deep", "marianas trench"]}'),
('geography', 1, '{"text": "On which continent is Brazil?", "type": "short_answer"}', '{"value": "South America", "accept": ["south america"]}'),
('geography', 2, '{"text": "What is the longest mountain range in the world?", "type": "short_answer"}', '{"value": "Andes", "accept": ["andes", "the andes", "andes mountains"]}'),
('geography', 3, '{"text": "What is the capital of Mongolia?", "type": "short_answer"}', '{"value": "Ulaanbaatar", "accept": ["ulaanbaatar", "ulan bator"]}'),
('geography', 1, '{"text": "What river flows through Egypt?", "type": "short_answer"}', '{"value": "Nile", "accept": ["nile", "the nile", "nile river"]}'),
('geography', 2, '{"text": "What is the largest lake in Africa?", "type": "short_answer"}', '{"value": "Lake Victoria", "accept": ["lake victoria", "victoria"]}'),
('geography', 1, '{"text": "What country is shaped like a boot?", "type": "short_answer"}', '{"value": "Italy", "accept": ["italy"]}'),
('geography', 2, '{"text": "What strait separates Europe from Africa?", "type": "short_answer"}', '{"value": "Strait of Gibraltar", "accept": ["strait of gibraltar", "gibraltar"]}'),
('geography', 3, '{"text": "What is the driest continent?", "type": "short_answer"}', '{"value": "Antarctica", "accept": ["antarctica"]}'),
('geography', 1, '{"text": "What is the largest country by area?", "type": "short_answer"}', '{"value": "Russia", "accept": ["russia"]}'),
('geography', 2, '{"text": "Which two countries share the longest international border?", "type": "short_answer"}', '{"value": "Canada and USA", "accept": ["canada and usa", "us and canada", "canada and united states", "usa and canada"]}');

-- =============================================
-- TRIVIA: Pop Culture (10 questions)
-- =============================================
INSERT INTO question_bank (category, difficulty, question, answer) VALUES
('pop_culture', 1, '{"text": "What is the name of Harry Potter''s pet owl?", "type": "short_answer"}', '{"value": "Hedwig", "accept": ["hedwig"]}'),
('pop_culture', 2, '{"text": "Who directed the movie Jurassic Park?", "type": "short_answer"}', '{"value": "Steven Spielberg", "accept": ["steven spielberg", "spielberg"]}'),
('pop_culture', 1, '{"text": "What is the name of the fictional country in Black Panther?", "type": "short_answer"}', '{"value": "Wakanda", "accept": ["wakanda"]}'),
('pop_culture', 2, '{"text": "What band sang ''Bohemian Rhapsody''?", "type": "short_answer"}', '{"value": "Queen", "accept": ["queen"]}'),
('pop_culture', 3, '{"text": "In what year was the first Star Wars movie released?", "type": "short_answer"}', '{"value": "1977", "accept": ["1977"]}'),
('pop_culture', 1, '{"text": "What is the name of Batman''s butler?", "type": "short_answer"}', '{"value": "Alfred", "accept": ["alfred", "alfred pennyworth"]}'),
('pop_culture', 2, '{"text": "Who created Mickey Mouse?", "type": "short_answer"}', '{"value": "Walt Disney", "accept": ["walt disney", "disney"]}'),
('pop_culture', 1, '{"text": "What is the highest-grossing film of all time (not adjusted)?", "type": "short_answer"}', '{"value": "Avatar", "accept": ["avatar"]}'),
('pop_culture', 2, '{"text": "What game features characters named Mario and Luigi?", "type": "short_answer"}', '{"value": "Super Mario Bros", "accept": ["super mario bros", "super mario", "mario", "mario bros"]}'),
('pop_culture', 3, '{"text": "What programming language was created by Guido van Rossum?", "type": "short_answer"}', '{"value": "Python", "accept": ["python"]}');

-- =============================================
-- ESTIMATION (20 questions)
-- =============================================
INSERT INTO question_bank (category, difficulty, question, answer) VALUES
('estimation', 1, '{"text": "What is the population of the United States (in millions)?", "type": "estimation"}', '{"value": 335}'),
('estimation', 2, '{"text": "How far is the Earth from the Sun in million km?", "type": "estimation"}', '{"value": 150}'),
('estimation', 1, '{"text": "How many hours are in a year?", "type": "estimation"}', '{"value": 8760}'),
('estimation', 2, '{"text": "What is the height of Mount Everest in meters?", "type": "estimation"}', '{"value": 8849}'),
('estimation', 3, '{"text": "How many cells are in the human body (in trillions)?", "type": "estimation"}', '{"value": 37}'),
('estimation', 1, '{"text": "What is the population of China (in billions)?", "type": "estimation"}', '{"value": 1.4}'),
('estimation', 2, '{"text": "How many countries are members of the United Nations?", "type": "estimation"}', '{"value": 193}'),
('estimation', 3, '{"text": "What is the diameter of Earth in km?", "type": "estimation"}', '{"value": 12742}'),
('estimation', 1, '{"text": "How many seconds are in a day?", "type": "estimation"}', '{"value": 86400}'),
('estimation', 2, '{"text": "What is the average depth of the ocean in meters?", "type": "estimation"}', '{"value": 3688}'),
('estimation', 3, '{"text": "How many species of birds exist worldwide (approximate)?", "type": "estimation"}', '{"value": 10000}'),
('estimation', 1, '{"text": "What is the surface area of Earth in million km²?", "type": "estimation"}', '{"value": 510}'),
('estimation', 2, '{"text": "How many languages are spoken in the world?", "type": "estimation"}', '{"value": 7000}'),
('estimation', 3, '{"text": "What is the age of the Earth in billion years?", "type": "estimation"}', '{"value": 4.5}'),
('estimation', 1, '{"text": "How many bones does a newborn baby have?", "type": "estimation"}', '{"value": 270}'),
('estimation', 2, '{"text": "What is the length of the Amazon River in km?", "type": "estimation"}', '{"value": 6400}'),
('estimation', 3, '{"text": "How many stars are in the Milky Way galaxy (in billions)?", "type": "estimation"}', '{"value": 200}'),
('estimation', 1, '{"text": "What percentage of Earth''s surface is covered by water?", "type": "estimation"}', '{"value": 71}'),
('estimation', 2, '{"text": "How many Olympic gold medals has Michael Phelps won?", "type": "estimation"}', '{"value": 23}'),
('estimation', 3, '{"text": "What is the distance from Earth to the Moon in thousands of km?", "type": "estimation"}', '{"value": 384}');
