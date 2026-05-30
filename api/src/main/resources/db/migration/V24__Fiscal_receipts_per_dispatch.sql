-- Move fiscal-receipt tracking from the order row to a per-dispatch record.
--
-- A partial payment produces MORE THAN ONE receipt per order (one per
-- installment), each covering a different set of items. The previous
-- order-level columns could only hold one status, so earlier installments'
-- results were overwritten/lost and a retry reprinted every item. We now track
-- one row per dispatch, keyed by request_id, with its own order + item scope.

CREATE TABLE fiscal_receipts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id              VARCHAR(64) NOT NULL UNIQUE,
    event_id                UUID,
    status                  VARCHAR(20) NOT NULL,          -- PENDING | ISSUED | FAILED
    payment_method          VARCHAR(20),
    cash_register_device_id VARCHAR(64),
    fiscal_receipt_id       VARCHAR(64),
    error                   VARCHAR(500),
    total_amount            NUMERIC(19, 2),
    -- A retry creates a fresh receipt and marks the old one superseded so it
    -- drops out of the "failed receipts" list without losing the audit trail.
    superseded              BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMP NOT NULL DEFAULT now(),
    attempted_at            TIMESTAMP
);

CREATE INDEX idx_fiscal_receipts_request_id   ON fiscal_receipts (request_id);
CREATE INDEX idx_fiscal_receipts_event_status ON fiscal_receipts (event_id, status);

-- Orders covered by a receipt (element collection).
CREATE TABLE fiscal_receipt_orders (
    fiscal_receipt_id UUID NOT NULL REFERENCES fiscal_receipts (id) ON DELETE CASCADE,
    order_id          UUID NOT NULL
);
CREATE INDEX idx_fiscal_receipt_orders_order ON fiscal_receipt_orders (order_id);

-- Item rows the receipt was scoped to (partial pay). Empty = full-pay scope.
CREATE TABLE fiscal_receipt_items (
    fiscal_receipt_id UUID NOT NULL REFERENCES fiscal_receipts (id) ON DELETE CASCADE,
    order_item_id     UUID NOT NULL
);

-- Drop the now-replaced order-level fiscal columns.
DROP INDEX IF EXISTS idx_orders_fiscal_request_id;
ALTER TABLE orders DROP COLUMN IF EXISTS fiscal_receipt_status;
ALTER TABLE orders DROP COLUMN IF EXISTS fiscal_receipt_id;
ALTER TABLE orders DROP COLUMN IF EXISTS fiscal_request_id;
ALTER TABLE orders DROP COLUMN IF EXISTS fiscal_error;
ALTER TABLE orders DROP COLUMN IF EXISTS fiscal_attempted_at;
