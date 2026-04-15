-- Add payment tracking fields to orders table
ALTER TABLE orders ADD COLUMN payment_method VARCHAR(20);
ALTER TABLE orders ADD COLUMN paid_by VARCHAR(100);
ALTER TABLE orders ADD COLUMN paid_at TIMESTAMP;
