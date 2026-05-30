-- Stable per-transaction id linking a payment to its fiscal receipt, surviving
-- retries (the receipt's request_id changes on retry; payment_ref does not).
-- order_payments carries it for each settled order; fiscal_receipts carries the
-- same value so the revenue report can show the bon number per payment.
ALTER TABLE order_payments  ADD COLUMN payment_ref UUID;
ALTER TABLE fiscal_receipts ADD COLUMN payment_ref UUID;

CREATE INDEX idx_order_payments_payment_ref  ON order_payments  (payment_ref);
CREATE INDEX idx_fiscal_receipts_payment_ref ON fiscal_receipts (payment_ref);
