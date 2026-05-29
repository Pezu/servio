-- Tracks how many distinct payment transactions settled an order. A value > 1
-- means the order was paid in multiple installments (partial pay from the app).
ALTER TABLE orders ADD COLUMN payment_count INT NOT NULL DEFAULT 0;

-- Backfill: orders already settled before this feature had exactly one payment.
UPDATE orders SET payment_count = 1 WHERE needs_payment = false;