-- Sequential receipt number printed on the bon, echoed by the device alongside
-- the fiscal-memory id. Stored next to fiscal_receipt_id (today the cash app
-- fills both with the same value, but they are distinct fields by protocol).
ALTER TABLE fiscal_receipts ADD COLUMN receipt_number VARCHAR(64);
