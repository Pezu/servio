-- Add logo_path column to clients table
ALTER TABLE clients ADD COLUMN logo_path VARCHAR(255);

-- Add logo_path column to events table
ALTER TABLE events ADD COLUMN logo_path VARCHAR(255);