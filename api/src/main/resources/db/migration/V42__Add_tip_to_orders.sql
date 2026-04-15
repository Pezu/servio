-- Add tip column to orders table
ALTER TABLE orders ADD COLUMN tip DECIMAL(19, 2) DEFAULT 0;
