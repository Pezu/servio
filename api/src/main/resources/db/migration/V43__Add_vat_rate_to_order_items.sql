-- Add vat_rate column to order_items table to track VAT rate at time of order
ALTER TABLE order_items ADD COLUMN vat_rate DECIMAL(5,2) DEFAULT 0.00;

-- Update existing items to use default VAT rate (can be adjusted manually if needed)
UPDATE order_items SET vat_rate = 0.00 WHERE vat_rate IS NULL;

ALTER TABLE order_items ALTER COLUMN vat_rate SET NOT NULL;
