-- Add created_at column to orders table
ALTER TABLE orders ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;