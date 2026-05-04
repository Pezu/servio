-- Reuse the existing cash_registers table for the ECR agent integration.
-- Each device authenticates over WebSocket using its uuid (deviceId) plus
-- the new shared_token.
ALTER TABLE cash_registers ADD COLUMN shared_token VARCHAR(255);
CREATE UNIQUE INDEX idx_cash_registers_uuid ON cash_registers(uuid);
