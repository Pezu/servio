-- Create a system client for admin users
INSERT INTO clients (id, name, email, phone, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'System', 'system@tapello.com', '', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Create admin user with role SUPER
-- Password: Cinci_55!! (BCrypt encoded)
INSERT INTO users (id, username, password, name, roles, client_id)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'admin',
    '$2b$10$PPUTcEAZuGbNkMjNJHDz5O2.o9DP8zfxRKegsFnBNaYo9Verpg3vq',
    'Administrator',
    ARRAY['SUPER'],
    '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (username) DO NOTHING;