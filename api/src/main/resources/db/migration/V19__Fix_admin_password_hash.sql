-- Fix BCrypt hash with properly generated $2a$ format for Java compatibility
-- Password: Cinci_55!!
UPDATE users
SET password = '$2a$10$W/1OlyjaUZzfyDA3E4xlTuz5ygSIb5QH1zLen1SluzXNf6CpZrOoi'
WHERE username = 'admin';