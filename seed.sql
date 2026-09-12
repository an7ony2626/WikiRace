-- ============================================================
-- ROADTOUNINA — seed.sql
-- Demo data for the local Docker Compose setup only: a handful of
-- users, completed games (for the leaderboard/completed list), and
-- one in-progress game to show the "resume" flow. Never used against
-- the live deployment (Supabase) — this file is mounted only by
-- docker-compose.yml, after schema.sql, on first container start.
--
-- All demo accounts share the password: Demo1234!
-- ============================================================

INSERT INTO users (username, email, password_hash) VALUES
    ('wikiwarrior', 'wikiwarrior@example.com', '$2b$12$KAUSYIAxo1Ak6sxozraqcOsaKFSndTplVZrlIMA12ogDk8WDxhrAi'),
    ('pixelnauta',  'pixelnauta@example.com',  '$2b$12$KAUSYIAxo1Ak6sxozraqcOsaKFSndTplVZrlIMA12ogDk8WDxhrAi'),
    ('saraSprint',  'sarasprint@example.com',  '$2b$12$KAUSYIAxo1Ak6sxozraqcOsaKFSndTplVZrlIMA12ogDk8WDxhrAi'),
    ('marcoVeloce', 'marcoveloce@example.com', '$2b$12$KAUSYIAxo1Ak6sxozraqcOsaKFSndTplVZrlIMA12ogDk8WDxhrAi'),
    ('GinoIlPro',   'ginoilpro@example.com',   '$2b$12$KAUSYIAxo1Ak6sxozraqcOsaKFSndTplVZrlIMA12ogDk8WDxhrAi');

-- wikiwarrior: Napoli -> Federico II (1 move, custom)
WITH new_game AS (
    INSERT INTO games (user_id, start_page_title, target_page_title, status, started_at, ended_at, num_steps, is_random_challenge, active_seconds)
    SELECT id, 'Napoli', 'Università degli Studi di Napoli Federico II', 'COMPLETED',
           now() - interval '9 days', now() - interval '9 days' + interval '47 seconds', 2, false, 47
    FROM users WHERE username = 'wikiwarrior'
    RETURNING id
)
INSERT INTO game_steps (game_id, step_number, page_title, visited_at)
SELECT id, 1, 'Napoli', now() - interval '9 days' FROM new_game
UNION ALL
SELECT id, 2, 'Università degli Studi di Napoli Federico II', now() - interval '9 days' + interval '47 seconds' FROM new_game;

-- wikiwarrior: Pizza -> Diego Armando Maradona (2 moves, custom)
WITH new_game AS (
    INSERT INTO games (user_id, start_page_title, target_page_title, status, started_at, ended_at, num_steps, is_random_challenge, active_seconds)
    SELECT id, 'Pizza', 'Diego Armando Maradona', 'COMPLETED',
           now() - interval '7 days', now() - interval '7 days' + interval '103 seconds', 3, false, 103
    FROM users WHERE username = 'wikiwarrior'
    RETURNING id
)
INSERT INTO game_steps (game_id, step_number, page_title, visited_at)
SELECT id, 1, 'Pizza', now() - interval '7 days' FROM new_game
UNION ALL
SELECT id, 2, 'Napoli', now() - interval '7 days' + interval '50 seconds' FROM new_game
UNION ALL
SELECT id, 3, 'Diego Armando Maradona', now() - interval '7 days' + interval '103 seconds' FROM new_game;

-- wikiwarrior: Spaghetti alla carbonara -> Guanciale (1 move, custom)
WITH new_game AS (
    INSERT INTO games (user_id, start_page_title, target_page_title, status, started_at, ended_at, num_steps, is_random_challenge, active_seconds)
    SELECT id, 'Spaghetti alla carbonara', 'Guanciale', 'COMPLETED',
           now() - interval '2 days', now() - interval '2 days' + interval '31 seconds', 2, false, 31
    FROM users WHERE username = 'wikiwarrior'
    RETURNING id
)
INSERT INTO game_steps (game_id, step_number, page_title, visited_at)
SELECT id, 1, 'Spaghetti alla carbonara', now() - interval '2 days' FROM new_game
UNION ALL
SELECT id, 2, 'Guanciale', now() - interval '2 days' + interval '31 seconds' FROM new_game;

-- pixelnauta: Diego Armando Maradona -> Coppa del Mondo FIFA 1986 (2 moves, custom)
WITH new_game AS (
    INSERT INTO games (user_id, start_page_title, target_page_title, status, started_at, ended_at, num_steps, is_random_challenge, active_seconds)
    SELECT id, 'Diego Armando Maradona', 'Coppa del Mondo FIFA 1986', 'COMPLETED',
           now() - interval '8 days', now() - interval '8 days' + interval '88 seconds', 3, false, 88
    FROM users WHERE username = 'pixelnauta'
    RETURNING id
)
INSERT INTO game_steps (game_id, step_number, page_title, visited_at)
SELECT id, 1, 'Diego Armando Maradona', now() - interval '8 days' FROM new_game
UNION ALL
SELECT id, 2, 'Argentina', now() - interval '8 days' + interval '45 seconds' FROM new_game
UNION ALL
SELECT id, 3, 'Coppa del Mondo FIFA 1986', now() - interval '8 days' + interval '88 seconds' FROM new_game;

-- saraSprint: Intelligenza artificiale -> Alan Turing (1 move, random)
WITH new_game AS (
    INSERT INTO games (user_id, start_page_title, target_page_title, status, started_at, ended_at, num_steps, is_random_challenge, active_seconds)
    SELECT id, 'Intelligenza artificiale', 'Alan Turing', 'COMPLETED',
           now() - interval '6 days', now() - interval '6 days' + interval '22 seconds', 2, true, 22
    FROM users WHERE username = 'saraSprint'
    RETURNING id
)
INSERT INTO game_steps (game_id, step_number, page_title, visited_at)
SELECT id, 1, 'Intelligenza artificiale', now() - interval '6 days' FROM new_game
UNION ALL
SELECT id, 2, 'Alan Turing', now() - interval '6 days' + interval '22 seconds' FROM new_game;

-- saraSprint: Leonardo da Vinci -> Gioconda (1 move, custom)
WITH new_game AS (
    INSERT INTO games (user_id, start_page_title, target_page_title, status, started_at, ended_at, num_steps, is_random_challenge, active_seconds)
    SELECT id, 'Leonardo da Vinci', 'Gioconda', 'COMPLETED',
           now() - interval '3 days', now() - interval '3 days' + interval '19 seconds', 2, false, 19
    FROM users WHERE username = 'saraSprint'
    RETURNING id
)
INSERT INTO game_steps (game_id, step_number, page_title, visited_at)
SELECT id, 1, 'Leonardo da Vinci', now() - interval '3 days' FROM new_game
UNION ALL
SELECT id, 2, 'Gioconda', now() - interval '3 days' + interval '19 seconds' FROM new_game;

-- marcoVeloce: Wikipedia -> Enciclopedia (1 move, custom)
WITH new_game AS (
    INSERT INTO games (user_id, start_page_title, target_page_title, status, started_at, ended_at, num_steps, is_random_challenge, active_seconds)
    SELECT id, 'Wikipedia', 'Enciclopedia', 'COMPLETED',
           now() - interval '5 days', now() - interval '5 days' + interval '15 seconds', 2, false, 15
    FROM users WHERE username = 'marcoVeloce'
    RETURNING id
)
INSERT INTO game_steps (game_id, step_number, page_title, visited_at)
SELECT id, 1, 'Wikipedia', now() - interval '5 days' FROM new_game
UNION ALL
SELECT id, 2, 'Enciclopedia', now() - interval '5 days' + interval '15 seconds' FROM new_game;

-- marcoVeloce: Colosseo -> Impero romano (2 moves, random)
WITH new_game AS (
    INSERT INTO games (user_id, start_page_title, target_page_title, status, started_at, ended_at, num_steps, is_random_challenge, active_seconds)
    SELECT id, 'Colosseo', 'Impero romano', 'COMPLETED',
           now() - interval '4 days', now() - interval '4 days' + interval '76 seconds', 3, true, 76
    FROM users WHERE username = 'marcoVeloce'
    RETURNING id
)
INSERT INTO game_steps (game_id, step_number, page_title, visited_at)
SELECT id, 1, 'Colosseo', now() - interval '4 days' FROM new_game
UNION ALL
SELECT id, 2, 'Roma', now() - interval '4 days' + interval '40 seconds' FROM new_game
UNION ALL
SELECT id, 3, 'Impero romano', now() - interval '4 days' + interval '76 seconds' FROM new_game;

-- GinoIlPro: Politecnico di Milano -> Federico II (3 moves, random)
WITH new_game AS (
    INSERT INTO games (user_id, start_page_title, target_page_title, status, started_at, ended_at, num_steps, is_random_challenge, active_seconds)
    SELECT id, 'Politecnico di Milano', 'Università degli Studi di Napoli Federico II', 'COMPLETED',
           now() - interval '10 days', now() - interval '10 days' + interval '134 seconds', 4, true, 134
    FROM users WHERE username = 'GinoIlPro'
    RETURNING id
)
INSERT INTO game_steps (game_id, step_number, page_title, visited_at)
SELECT id, 1, 'Politecnico di Milano', now() - interval '10 days' FROM new_game
UNION ALL
SELECT id, 2, 'Milano', now() - interval '10 days' + interval '45 seconds' FROM new_game
UNION ALL
SELECT id, 3, 'Italia', now() - interval '10 days' + interval '90 seconds' FROM new_game
UNION ALL
SELECT id, 4, 'Università degli Studi di Napoli Federico II', now() - interval '10 days' + interval '134 seconds' FROM new_game;

-- GinoIlPro: an in-progress, paused game — shows up as "Sfida in corso"
-- (resumable) if you log in as GinoIlPro / Demo1234!
WITH new_game AS (
    INSERT INTO games (user_id, start_page_title, target_page_title, status, started_at, ended_at, num_steps, is_random_challenge, active_seconds, last_resumed_at)
    SELECT id, 'Cristiano Ronaldo', 'Juventus Football Club', 'IN_PROGRESS',
           now() - interval '1 hour', NULL, 1, false, 42, NULL
    FROM users WHERE username = 'GinoIlPro'
    RETURNING id
)
INSERT INTO game_steps (game_id, step_number, page_title, visited_at)
SELECT id, 1, 'Cristiano Ronaldo', now() - interval '1 hour' FROM new_game;
