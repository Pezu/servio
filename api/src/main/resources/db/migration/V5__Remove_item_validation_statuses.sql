-- Validation per order item is no longer a feature. Collapse PREPARING and DONE
-- back to ORDERED so the items only ever exist in ORDERED or CANCELLED.
UPDATE order_items SET status = 'ORDERED' WHERE status IN ('PREPARING', 'DONE');
