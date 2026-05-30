-- Decouples the fiscal-receipt lifecycle from the payment lifecycle.
--
-- An order can be PAID while its fiscal receipt is still PENDING, or FAILED
-- (printer unreachable, out of paper, Z report required, ...). Until now a
-- print failure was only logged + broadcast transiently, so a paid order with
-- no fiscal receipt was invisible and could not be retried.
--
-- fiscal_receipt_status: PENDING | ISSUED | FAILED. NULL = no receipt was ever
--   attempted (PROTOCOL payments, or no ECR device configured for the event).
-- fiscal_request_id: the requestId dispatched to the bridge; the async agent
--   reply is correlated back to the order(s) through this value.
ALTER TABLE orders ADD COLUMN fiscal_receipt_status VARCHAR(20);
ALTER TABLE orders ADD COLUMN fiscal_receipt_id     VARCHAR(64);
ALTER TABLE orders ADD COLUMN fiscal_request_id     VARCHAR(64);
ALTER TABLE orders ADD COLUMN fiscal_error          VARCHAR(500);
ALTER TABLE orders ADD COLUMN fiscal_attempted_at   TIMESTAMP;

CREATE INDEX idx_orders_fiscal_request_id ON orders (fiscal_request_id);
